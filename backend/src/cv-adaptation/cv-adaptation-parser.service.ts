import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenaiService } from '../openai/openai.service';
import type { AdaptedProfileSnapshot } from './cv-adaptation.types';

export interface ExperienceRewrite {
  originalId: string;
  text: string;
}

export interface AdaptationResult {
  experienceDescriptions: ExperienceRewrite[];
}

export interface AdaptationInput {
  profile: AdaptedProfileSnapshot;
  offer: {
    title: string | null;
    company: string | null;
    requiredSkills: string[];
    preferredSkills: string[];
    keywords: string[];
    experienceSummary: string | null;
  };
  matchedSkills: string[];
  missingSkills: string[];
  sourceLanguage: string | null;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeExperienceDescriptions(
  value: unknown,
): ExperienceRewrite[] | null {
  if (!Array.isArray(value)) return null;
  const rewrites: ExperienceRewrite[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return null;
    const record = item as Record<string, unknown>;
    const originalId = nonEmptyString(record.originalId);
    const text = nonEmptyString(record.text);
    if (originalId === null || text === null) return null;
    rewrites.push({ originalId, text });
  }
  return rewrites;
}

// Reformula prosa del CV adaptado con la API de OpenAI (structured outputs).
// Solo produce summary y experiences[].description: las reglas del sistema
// construyen el resto del contenido y el service valida los originalId.
@Injectable()
export class CvAdaptationParserService {
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

  async adapt(input: AdaptationInput): Promise<AdaptationResult> {
    const targetLanguage = this.resolveTargetLanguage(input.sourceLanguage);
    try {
      const completion =
        await this.openaiService.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: this.buildSystemPrompt(targetLanguage) },
            {
              role: 'user',
              content: `Oferta de trabajo:\n${JSON.stringify(input.offer)}`,
            },
            {
              role: 'user',
              content: `Perfil del candidato:\n${JSON.stringify(input.profile)}`,
            },
            {
              role: 'user',
              content: `Skills del candidato presentes en la oferta: ${JSON.stringify(input.matchedSkills)}\nSkills de la oferta que el candidato NO tiene (nunca los afirmes): ${JSON.stringify(input.missingSkills)}`,
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'cv_adaptation',
              strict: true,
              schema: this.buildAdaptationSchema(),
            },
          },
        });
      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('empty response');
      }
      const raw = JSON.parse(content) as Record<string, unknown>;
      const result = this.normalize(raw, input.missingSkills);
      if (!result) {
        throw new Error('invalid shape');
      }
      return result;
    } catch (error) {
      console.error('OpenAI cv adaptation failed:', error);
      throw new BadGatewayException(
        'La IA no pudo adaptar el CV. Intenta de nuevo.',
      );
    }
  }

  private resolveTargetLanguage(sourceLanguage: string | null): 'es' | 'en' {
    const lower = sourceLanguage?.toLowerCase() ?? '';
    if (
      lower === 'es' ||
      lower.startsWith('español') ||
      lower.includes('spanish')
    ) {
      return 'es';
    }
    return 'en';
  }

  private buildSystemPrompt(targetLanguage: 'es' | 'en'): string {
    const writeIn =
      targetLanguage === 'es'
        ? 'Write the rewritten descriptions in Spanish. Do not translate proper nouns (companies, positions, degrees, certifications, project names).'
        : 'Write the rewritten descriptions in English. Do not translate proper nouns (companies, positions, degrees, certifications, project names).';
    return [
      'You adapt the experience descriptions of a candidate CV for a specific job so recruiters and ATS filters read them naturally.',
      'You receive the real candidate profile snapshot and the job offer.',
      'You must produce ONLY ONE thing: rewritten descriptions for existing experiences.',
      'Every rewritten description must reference an existing originalId from the profile snapshot. Never add, remove or reorder experiences; never invent companies, positions, dates, achievements, metrics, education, certifications, projects, languages or skills.',
      'Integrate the matched skills and offer keywords naturally into the prose. The result must sound written by a professional person: no keyword stuffing, no detached keyword lists.',
      'Never claim that the candidate has a missing skill: the matchedSkills list is the only truth about what the candidate can highlight.',
      'Keep every factual claim identical to the snapshot; only rephrase for clarity, relevance and natural keyword emphasis.',
      writeIn,
      'The candidate summary is NOT your job: it is generated deterministically elsewhere. Never output a summary.',
    ].join(' ');
  }

  private buildAdaptationSchema(): Record<string, unknown> {
    return {
      type: 'object',
      additionalProperties: false,
      properties: {
        experienceDescriptions: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              originalId: { type: 'string' },
              text: { type: 'string' },
            },
            required: ['originalId', 'text'],
          },
        },
      },
      required: ['experienceDescriptions'],
    };
  }

  // Guardia determinista: descarta cualquier descripción que afirme un skill
  // faltante o invente tecnologías que no existen en el snapshot. La supervisión
  // del text basta porque los skills son tokens con nombre propio.
  private normalize(
    raw: Record<string, unknown>,
    missingSkills: string[],
  ): AdaptationResult | null {
    const experienceDescriptions = normalizeExperienceDescriptions(
      raw.experienceDescriptions,
    );
    if (experienceDescriptions === null) {
      return null;
    }
    const forbidden = missingSkills.map((skill) => skill.toLowerCase());
    const safe = experienceDescriptions.filter(
      (item) =>
        !forbidden.some((skill) => this.mentionsSkill(item.text, skill)),
    );
    return { experienceDescriptions: safe };
  }

  private mentionsSkill(text: string, skillToken: string): boolean {
    if (skillToken.length === 0) {
      return false;
    }
    return text.toLowerCase().includes(skillToken);
  }
}
