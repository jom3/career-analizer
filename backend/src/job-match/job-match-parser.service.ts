import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenaiService } from '../openai/openai.service';
import type { MatchLang } from './dto/job-match.dto';
import type {
  JobMatchDimension,
  JobMatchGap,
  JobMatchRecommendation,
} from './dto/job-match.dto';
import type { ProfileSnapshot } from './profile-util';
import type { JobOfferDraft } from '../job-analysis/job-analysis.types';

export interface MatchAnalysis {
  overallScore: number;
  overallJustification: string;
  dimensions: JobMatchDimension[];
  gaps: JobMatchGap[];
  recommendations: JobMatchRecommendation[];
}

const DIMENSION_KEYS = [
  'skills',
  'experience',
  'education',
  'languages',
] as const;

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function clampScore(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function nullableScore(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  return clampScore(value);
}

function isDimensionKey(
  value: unknown,
): value is (typeof DIMENSION_KEYS)[number] {
  return (
    typeof value === 'string' &&
    (DIMENSION_KEYS as readonly string[]).includes(value)
  );
}

function normalizeDimensions(value: unknown): JobMatchDimension[] | null {
  if (!Array.isArray(value)) return null;
  const dimensions: JobMatchDimension[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return null;
    const record = item as Record<string, unknown>;
    if (!isDimensionKey(record.key)) return null;
    const score = nullableScore(record.score);
    const justification = nonEmptyString(record.justification);
    if (justification === null) return null;
    dimensions.push({ key: record.key, score, justification });
  }
  const present = new Set(dimensions.map((d) => d.key));
  for (const key of DIMENSION_KEYS) {
    if (!present.has(key)) {
      dimensions.push({ key, score: null, justification: '' });
    }
  }
  return dimensions;
}

function normalizeGapStatus(
  value: unknown,
): 'HAVE' | 'MISSING' | 'PARTIAL' | null {
  if (value === 'HAVE' || value === 'MISSING' || value === 'PARTIAL')
    return value;
  return null;
}

function normalizeGapSource(
  value: unknown,
): 'REQUIRED' | 'PREFERRED' | 'OTHER' | null {
  if (value === 'REQUIRED' || value === 'PREFERRED' || value === 'OTHER')
    return value;
  return null;
}

function normalizeGaps(value: unknown): JobMatchGap[] | null {
  if (!Array.isArray(value)) return null;
  const gaps: JobMatchGap[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return null;
    const record = item as Record<string, unknown>;
    const name = nonEmptyString(record.name);
    const status = normalizeGapStatus(record.status);
    const source = normalizeGapSource(record.source);
    if (name === null || status === null || source === null) return null;
    const note = nonEmptyString(record.note);
    gaps.push({ name, status, source, ...(note !== null ? { note } : {}) });
  }
  return gaps;
}

function normalizeRecommendationType(
  value: unknown,
): 'SKILL' | 'PROFILE' | null {
  if (value === 'SKILL' || value === 'PROFILE') return value;
  return null;
}

function normalizeRecommendations(
  value: unknown,
): JobMatchRecommendation[] | null {
  if (!Array.isArray(value)) return null;
  const recommendations: JobMatchRecommendation[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return null;
    const record = item as Record<string, unknown>;
    const type = normalizeRecommendationType(record.type);
    const target = nonEmptyString(record.target);
    const suggestion = nonEmptyString(record.suggestion);
    if (type === null || target === null || suggestion === null) return null;
    recommendations.push({ type, target, suggestion });
  }
  return recommendations;
}

// Analiza el encaje entre el perfil del candidato y una oferta con la API de
// OpenAI usando structured outputs. El resultado es un grado de coincidencia por
// dimensión, los gaps entre los skills declarados por la oferta y recomendaciones
// escritas en el idioma de la interfaz. Nunca inventa habilidades: los gaps se
// acotan a los skills de la oferta (la whitelist se aplica en el service).
@Injectable()
export class JobMatchParserService {
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

  async match(
    offer: JobOfferDraft,
    profile: ProfileSnapshot,
    lang: MatchLang,
  ): Promise<MatchAnalysis> {
    try {
      const completion =
        await this.openaiService.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: this.buildSystemPrompt(lang) },
            {
              role: 'user',
              content: `Oferta de trabajo:\n${JSON.stringify(offer)}`,
            },
            {
              role: 'user',
              content: `Perfil del candidato:\n${JSON.stringify(profile)}`,
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'job_match_analysis',
              strict: true,
              schema: this.buildMatchSchema(),
            },
          },
        });
      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('empty response');
      }
      const raw = JSON.parse(content) as Record<string, unknown>;
      const analysis = this.normalize(raw);
      if (!analysis) {
        throw new Error('invalid shape');
      }
      return analysis;
    } catch (error) {
      console.error('OpenAI job match failed:', error);
      throw new BadGatewayException(
        'La IA no pudo calcular el encaje. Intenta de nuevo.',
      );
    }
  }

  private buildSystemPrompt(lang: MatchLang): string {
    const responseLanguage =
      lang === 'es'
        ? 'Escribí toda la respuesta en español.'
        : 'Write the entire response in English.';
    return [
      'You are a career matching analyst.',
      'Compare the candidate profile against the job offer and score how well the candidate fits.',
      'Scores must be evidence-based: rely only on data present in the candidate profile. Do not invent experience, skills, companies, positions, education, certifications, projects or achievements.',
      'overallScore is the global fit (0-100). dimensions has exactly four entries: skills, experience, education, languages; each with a score (0-100). If a dimension has no data in the profile, use null for score and explain the absence in the justification.',
      'gaps: only list skills that the job offer declares (requiredSkills, preferredSkills, or skills mentioned in experienceSummary). name must be one of those offer skills exactly. status: HAVE when the profile evidences that skill, MISSING when there is no evidence, PARTIAL when there is partial or weak evidence. source: REQUIRED if the skill comes from requiredSkills, PREFERRED from preferredSkills, OTHER otherwise. Never list a skill that is not in the offer.',
      'recommendations: type SKILL when derived from a gap (what to work on and how to demonstrate it in the profile), type PROFILE for suggestions to strengthen the profile (e.g. quantify metrics, add certifications, complete the summary). They are mere suggestions in natural, professional prose; do not invent external resources, courses or links.',
      responseLanguage,
    ].join(' ');
  }

  private buildMatchSchema(): Record<string, unknown> {
    const nullableInteger = { type: ['integer', 'null'] };

    return {
      type: 'object',
      additionalProperties: false,
      properties: {
        overallScore: { type: 'integer', minimum: 0, maximum: 100 },
        overallJustification: { type: 'string' },
        dimensions: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              key: { type: 'string', enum: [...DIMENSION_KEYS] },
              score: nullableInteger,
              justification: { type: 'string' },
            },
            required: ['key', 'score', 'justification'],
          },
        },
        gaps: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: 'string' },
              status: { type: 'string', enum: ['HAVE', 'MISSING', 'PARTIAL'] },
              source: {
                type: 'string',
                enum: ['REQUIRED', 'PREFERRED', 'OTHER'],
              },
              note: { type: ['string', 'null'] },
            },
            required: ['name', 'status', 'source', 'note'],
          },
        },
        recommendations: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string', enum: ['SKILL', 'PROFILE'] },
              target: { type: 'string' },
              suggestion: { type: 'string' },
            },
            required: ['type', 'target', 'suggestion'],
          },
        },
      },
      required: [
        'overallScore',
        'overallJustification',
        'dimensions',
        'gaps',
        'recommendations',
      ],
    };
  }

  private normalize(raw: Record<string, unknown>): MatchAnalysis | null {
    const overallScore = clampScore(raw.overallScore);
    if (overallScore === null) return null;
    const overallJustification = nonEmptyString(raw.overallJustification);
    if (overallJustification === null) return null;
    const dimensions = normalizeDimensions(raw.dimensions);
    const gaps = normalizeGaps(raw.gaps);
    const recommendations = normalizeRecommendations(raw.recommendations);
    if (dimensions === null || gaps === null || recommendations === null) {
      return null;
    }
    return {
      overallScore,
      overallJustification,
      dimensions,
      gaps,
      recommendations,
    };
  }
}
