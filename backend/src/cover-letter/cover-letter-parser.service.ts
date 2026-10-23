import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { apiError } from '../common/api-error-codes';
import { mentionsToken } from '../common/token-mention';
import { OpenaiService } from '../openai/openai.service';
import type { ProfileSnapshot } from '../job-match/profile-util';
import {
  MAX_WORDS,
  validateLetter,
  type CoverLetterWarning,
} from './letter-validators';
import { buildCoverLetterSystemPrompt } from './prompts/cover-letter.prompt';
import { buildCorrectionPrompt } from './prompts/correction.prompt';

export interface CoverLetterMatchInsight {
  overallScore: number | null;
  overallJustification: string | null;
  dimensions: {
    key: string;
    score: number | null;
    justification: string;
  }[];
  gaps: {
    name: string;
    status: 'HAVE' | 'MISSING' | 'PARTIAL';
  }[];
}

export interface CoverLetterGenerationInput {
  profile: ProfileSnapshot;
  offer: {
    title: string | null;
    company: string | null;
    responsibilities: string[];
    requiredSkills: string[];
    preferredSkills: string[];
    experienceSummary: string | null;
    keywords: string[];
  };
  recruiterName: string | null;
  note: string | null;
  lang: 'es' | 'en';
  match: CoverLetterMatchInsight | null;
}

export interface CoverLetterGenerationResult {
  content: string;
  wordCount: number;
  warnings: CoverLetterWarning[];
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function countWords(content: string): number {
  const trimmed = content.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

// Texto que recibe la corrección: la infracción en términos accionables.
function describeViolation(warning: CoverLetterWarning): string {
  switch (warning.code) {
    case 'WORD_LIMIT':
      return `Reduce the letter to ${MAX_WORDS} words or fewer (it has ${warning.detail}).`;
    case 'BANNED_PHRASE':
      return `Remove these phrases: ${warning.detail}.`;
    case 'EMPLOYER_NAME':
      return `Remove the employer name "${warning.detail}" and describe the sector instead.`;
    case 'TARGET_COMPANY_REPEATED':
      return `Mention the target company at most once (it appears ${warning.detail} times).`;
    case 'GENERIC_CLOSING':
      return 'Replace the closing line with a concrete availability or interview statement only.';
    case 'EMPTY_ADJECTIVE':
      return `Remove or back with a number these vague adjectives: ${warning.detail}.`;
    case 'MISSING_SKILL':
      return `Remove every mention of these skills, the candidate does not have them, not even to deny them: ${warning.detail}.`;
    case 'GERUND':
      return `Replace these gerunds with a conjugated verb, without adding facts: ${warning.detail}.`;
    case 'UNSUPPORTED_NUMBER':
      return `Remove or replace these figures: they do not appear in the profile or the offer (${warning.detail}).`;
    default:
      return warning.code;
  }
}

// Redacta el cuerpo de la carta (saludo → cierre) con la API de OpenAI.
// El borrador se valida y, si hay infracciones, se corrige en una sola pasada
// cerrada. Nunca se persiste sin edición humana.
@Injectable()
export class CoverLetterParserService {
  private readonly model: string;

  constructor(
    configService: ConfigService,
    private readonly openaiService: OpenaiService,
  ) {
    this.model = configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
  }

  get modelName(): string {
    return this.model;
  }

  async generate(
    input: CoverLetterGenerationInput,
  ): Promise<CoverLetterGenerationResult> {
    const draft = await this.draft(input);
    const warnings = this.validate(draft.content, input);
    if (warnings.length === 0) {
      return { ...draft, wordCount: countWords(draft.content), warnings };
    }

    const corrected = await this.correct(draft.content, warnings, input.lang);
    const content = this.dropSentencesWithMissingSkills(
      corrected.content,
      this.missingSkills(input),
    );
    const remaining = this.validate(content, input);
    return {
      content,
      wordCount: countWords(content),
      warnings: remaining,
    };
  }

  // Red de seguridad determinista: si la corrección deja una mención a una skill
  // que el perfil no tiene, se quita la oración completa. Quitar no agrega hechos.
  private dropSentencesWithMissingSkills(
    content: string,
    missingSkills: string[],
  ): string {
    if (missingSkills.length === 0) {
      return content;
    }
    return content
      .split('\n')
      .map((line) =>
        line
          .split(/(?<=[.!?])\s+/)
          .filter(
            (sentence) =>
              !missingSkills.some((skill) => mentionsToken(sentence, skill)),
          )
          .join(' '),
      )
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private validate(
    content: string,
    input: CoverLetterGenerationInput,
  ): CoverLetterWarning[] {
    return validateLetter(content, {
      lang: input.lang,
      employers: input.profile.experiences
        .map((experience) => experience.company)
        .filter((company): company is string => Boolean(company)),
      targetCompany: input.offer.company,
      supportedNumbers: this.supportedNumbers(input),
      missingSkills: this.missingSkills(input),
    });
  }

  // Skills de la oferta que no aparecen en ningún dato del perfil.
  private missingSkills(input: CoverLetterGenerationInput): string[] {
    const profileText = JSON.stringify(input.profile);
    return [
      ...input.offer.requiredSkills,
      ...input.offer.preferredSkills,
    ].filter((skill) => !mentionsToken(profileText, skill));
  }

  // Cifras que la carta puede usar: las que ya existen en el perfil o la oferta.
  private supportedNumbers(input: CoverLetterGenerationInput): string[] {
    const source = JSON.stringify({
      profile: input.profile,
      offer: input.offer,
    });
    return [...source.matchAll(/\d+(?:[.,]\d+)?\s?%?/g)].map(
      (match) => match[0],
    );
  }

  private async draft(
    input: CoverLetterGenerationInput,
  ): Promise<{ content: string }> {
    const messages: { role: 'system' | 'user'; content: string }[] = [
      {
        role: 'system',
        content: buildCoverLetterSystemPrompt(input.lang),
      },
      { role: 'user', content: `Job offer:\n${JSON.stringify(input.offer)}` },
      {
        role: 'user',
        content: `Candidate profile snapshot:\n${JSON.stringify(input.profile)}`,
      },
      {
        role: 'user',
        content: `Recruiter name (empty means a generic greeting): ${input.recruiterName ?? ''}\nAdditional note from the candidate: ${input.note ?? ''}`,
      },
    ];
    if (input.match) {
      messages.push({
        role: 'user',
        content: `Job match analysis (use it to pick the strongest real evidence; NEVER claim anything the profile snapshot does not contain):\n${JSON.stringify(input.match)}`,
      });
    }

    return this.complete(messages, 'OpenAI cover letter generation failed:');
  }

  private async correct(
    content: string,
    warnings: CoverLetterWarning[],
    lang: 'es' | 'en',
  ): Promise<{ content: string }> {
    const violations = warnings.map(describeViolation);
    try {
      return await this.complete(
        [
          {
            role: 'system',
            content: buildCorrectionPrompt(violations, lang),
          },
          { role: 'user', content },
        ],
        'OpenAI cover letter correction failed:',
      );
    } catch (error) {
      // La corrección es best-effort: si falla, se entrega el borrador con sus
      // advertencias para que el usuario lo revise.
      console.error(
        'OpenAI cover letter correction failed, returning draft with warnings:',
        error,
      );
      return { content };
    }
  }

  private async complete(
    messages: { role: 'system' | 'user'; content: string }[],
    errorLabel: string,
  ): Promise<{ content: string }> {
    try {
      const completion =
        await this.openaiService.client.chat.completions.create({
          model: this.model,
          temperature: 0,
          messages,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'cover_letter',
              strict: true,
              schema: this.buildSchema(),
            },
          },
        });
      const raw = JSON.parse(
        completion.choices[0]?.message?.content ?? 'null',
      ) as Record<string, unknown> | null;
      const result = raw ? this.normalize(raw) : null;
      if (!result) {
        throw new Error('invalid shape');
      }
      return result;
    } catch (error) {
      console.error(errorLabel, error);
      throw new BadGatewayException(
        apiError(
          'AI_UNAVAILABLE',
          'La IA no pudo redactar la carta. Intentá de nuevo.',
        ),
      );
    }
  }

  private buildSchema(): Record<string, unknown> {
    return {
      type: 'object',
      additionalProperties: false,
      properties: {
        content: { type: 'string' },
      },
      required: ['content'],
    };
  }

  private normalize(raw: Record<string, unknown>): { content: string } | null {
    const content = nonEmptyString(raw.content);
    if (content === null) {
      return null;
    }
    return { content };
  }
}
