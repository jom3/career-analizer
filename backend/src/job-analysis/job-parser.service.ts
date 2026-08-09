import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenaiService } from '../openai/openai.service';
import { JobLevel } from '../generated/prisma/enums.js';
import { JobOfferDraft, SourceLanguage } from './job-analysis.types';

const SPANISH_STOPWORDS = [
  'el',
  'la',
  'los',
  'las',
  'de',
  'y',
  'en',
  'experiencia',
  'habilidades',
  'educación',
  'requisitos',
  'responsabilidades',
  'salario',
  'empresa',
  'puesto',
  'años',
  'equipo',
  'remoto',
  'ingeniero',
  'desarrollo',
];

const ENGLISH_STOPWORDS = [
  'the',
  'and',
  'experience',
  'skills',
  'education',
  'requirements',
  'responsibilities',
  'salary',
  'company',
  'position',
  'role',
  'job',
  'software',
  'engineer',
  'years',
  'team',
  'remote',
  'building',
];

export function detectLanguage(text: string): SourceLanguage {
  const lower = text.toLowerCase();
  let spanish = 0;
  let english = 0;
  for (const word of SPANISH_STOPWORDS) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) spanish++;
  }
  for (const word of ENGLISH_STOPWORDS) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) english++;
  }
  if (spanish === 0 && english === 0) return 'other';
  return spanish >= english ? 'es' : 'en';
}

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function nullableInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

// Parsea una oferta de trabajo con la API de OpenAI usando structured outputs.
// Extrae solo datos presentes en la fuente (texto o imagen) y devuelve un
// borrador relajado; nunca inventa: lo incierto queda null.
@Injectable()
export class JobParserService {
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

  async parseText(
    text: string,
  ): Promise<{ draft: JobOfferDraft; sourceLanguage: SourceLanguage }> {
    const sourceLanguage = detectLanguage(text);
    try {
      const completion =
        await this.openaiService.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: this.buildSystemPrompt() },
            { role: 'user', content: `Oferta de trabajo:\n\n${text}` },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'job_offer_draft',
              strict: true,
              schema: this.buildDraftSchema(),
            },
          },
        });
      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('empty response');
      }
      return {
        draft: this.normalize(JSON.parse(content) as Record<string, unknown>),
        sourceLanguage,
      };
    } catch (error) {
      console.error('OpenAI text parsing failed:', error);
      throw new BadGatewayException(
        'La IA no pudo interpretar la oferta. Intenta de nuevo.',
      );
    }
  }

  async parseImage(
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ draft: JobOfferDraft; sourceLanguage: SourceLanguage }> {
    const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
    try {
      const completion =
        await this.openaiService.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: this.buildSystemPrompt() },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Analizá la siguiente imagen de una oferta de trabajo.',
                },
                { type: 'image_url', image_url: { url: dataUrl } },
              ],
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'job_offer_draft',
              strict: true,
              schema: this.buildDraftSchema(),
            },
          },
        });
      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('empty response');
      }
      const draft = this.normalize(
        JSON.parse(content) as Record<string, unknown>,
      );
      const text = [draft.title, draft.company, draft.experienceSummary].join(
        ' ',
      );
      return { draft, sourceLanguage: detectLanguage(text) };
    } catch (error) {
      console.error('OpenAI image parsing failed:', error);
      throw new BadGatewayException(
        'La IA no pudo analizar la imagen. Intenta de nuevo.',
      );
    }
  }

  private buildSystemPrompt(): string {
    return [
      'You are a job offer analyzer.',
      'Extract only information that appears explicitly in the job posting.',
      'Never invent or infer data: if something is missing or uncertain, return it as null.',
      'Respond with the content in the same language as the job posting.',
      'Return the level as one of: Junior, Mid, Senior, Lead, Executive. If the posting does not state a level, return null.',
      'requiredSkills: only what the posting requires explicitly (requirements/requisitos). preferredSkills: what is marked as nice-to-have, desired, or preferred. If the posting does not distinguish them, put everything in requiredSkills.',
      'experienceYears: only the number of years the posting requires, if stated. experienceSummary: keep the relevant text as-is.',
      'keywords: the most relevant keywords and tech terms of the posting.',
      'Extract data faithfully; do not correct, paraphrase, or invent.',
    ].join(' ');
  }

  private buildDraftSchema(): Record<string, unknown> {
    const nullableString = { type: ['string', 'null'] };
    const nullableInteger = { type: ['integer', 'null'] };
    const stringArray = { type: 'array', items: { type: 'string' } };

    return {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: nullableString,
        company: nullableString,
        level: nullableString,
        responsibilities: stringArray,
        requiredSkills: stringArray,
        preferredSkills: stringArray,
        experienceYears: nullableInteger,
        experienceSummary: nullableString,
        education: stringArray,
        languages: stringArray,
        keywords: stringArray,
      },
      required: [
        'title',
        'company',
        'level',
        'responsibilities',
        'requiredSkills',
        'preferredSkills',
        'experienceYears',
        'experienceSummary',
        'education',
        'languages',
        'keywords',
      ],
    };
  }

  private normalize(raw: Record<string, unknown>): JobOfferDraft {
    return {
      title: nonEmpty(nullableString(raw.title)),
      company: nonEmpty(nullableString(raw.company)),
      level: this.normalizeLevel(nullableString(raw.level)),
      responsibilities: stringArray(raw.responsibilities),
      requiredSkills: stringArray(raw.requiredSkills),
      preferredSkills: stringArray(raw.preferredSkills),
      experienceYears: nullableInt(raw.experienceYears),
      experienceSummary: nonEmpty(nullableString(raw.experienceSummary)),
      education: stringArray(raw.education),
      languages: stringArray(raw.languages),
      keywords: stringArray(raw.keywords),
    };
  }

  private normalizeLevel(value: string | null): JobLevel | null {
    if (value === null) return null;
    const upper = value.trim().toUpperCase();
    switch (upper) {
      case 'JUNIOR':
        return JobLevel.Junior;
      case 'MID':
      case 'MIDLEVEL':
      case 'MID-LEVEL':
        return JobLevel.Mid;
      case 'SENIOR':
        return JobLevel.Senior;
      case 'LEAD':
      case 'LEADER':
        return JobLevel.Lead;
      case 'EXECUTIVE':
      case 'DIRECTOR':
        return JobLevel.Executive;
      default:
        return null;
    }
  }
}
