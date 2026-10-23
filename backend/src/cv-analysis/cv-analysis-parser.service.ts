import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { apiError } from '../common/api-error-codes';
import { profileSnapshot } from '../job-match/profile-util';
import type { ProfileWithCollections } from '../profile/profile.service';
import { OpenaiService } from '../openai/openai.service';
import {
  CV_SECTIONS,
  type CvSection,
  type CvSuggestion,
} from './cv-analysis.types';

export interface CvReview {
  strengths: string[];
  suggestions: CvSuggestion[];
}

const MAX_ITEMS = 4;

function nonEmptyStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function isSection(value: unknown): value is CvSection {
  return (
    typeof value === 'string' &&
    (CV_SECTIONS as readonly string[]).includes(value)
  );
}

// Revisión del CV con IA. Solo redacta fortalezas y sugerencias: la nota la
// calcula el servicio de forma determinista.
@Injectable()
export class CvAnalysisParserService {
  private readonly model: string;

  constructor(
    configService: ConfigService,
    private readonly openaiService: OpenaiService,
  ) {
    this.model = configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
  }

  async review(
    profile: ProfileWithCollections,
    lang: 'es' | 'en',
  ): Promise<CvReview> {
    try {
      const completion =
        await this.openaiService.client.chat.completions.create({
          model: this.model,
          temperature: 0,
          messages: [
            { role: 'system', content: this.buildSystemPrompt(lang) },
            {
              role: 'user',
              content: `Perfil del candidato:\n${JSON.stringify(profileSnapshot(profile))}`,
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'cv_review',
              strict: true,
              schema: this.buildSchema(),
            },
          },
        });
      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('empty response');
      }
      const raw = JSON.parse(content) as Record<string, unknown>;
      return this.normalize(raw);
    } catch (error) {
      console.error('OpenAI cv analysis failed:', error);
      throw new BadGatewayException(
        apiError(
          'AI_UNAVAILABLE',
          'La IA no pudo analizar el CV. Intentá de nuevo.',
        ),
      );
    }
  }

  private buildSystemPrompt(lang: 'es' | 'en'): string {
    const language = lang === 'es' ? 'Write in Spanish.' : 'Write in English.';
    return [
      'You are a CV reviewer.',
      'You receive a candidate profile snapshot. Return 2 to 4 strengths and 2 to 4 suggestions.',
      'A strength states what is already solid, citing concrete data from the snapshot (a technology, a project, a number).',
      'A suggestion is one concrete action for the given section, for example adding a metric to an existing experience or completing an empty section.',
      'Never invent experience, skills, companies, education, projects or metrics.',
      'Never suggest adding something the snapshot already contains.',
      'One short sentence per item, no bullet characters, no extra commentary.',
      language,
    ].join(' ');
  }

  private buildSchema(): Record<string, unknown> {
    return {
      type: 'object',
      additionalProperties: false,
      properties: {
        strengths: {
          type: 'array',
          maxItems: MAX_ITEMS,
          items: { type: 'string' },
        },
        suggestions: {
          type: 'array',
          maxItems: MAX_ITEMS,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              section: { type: 'string', enum: [...CV_SECTIONS] },
              action: { type: 'string' },
            },
            required: ['section', 'action'],
          },
        },
      },
      required: ['strengths', 'suggestions'],
    };
  }

  private normalize(raw: Record<string, unknown>): CvReview {
    const strengths = [...new Set(nonEmptyStrings(raw.strengths))].slice(
      0,
      MAX_ITEMS,
    );
    const suggestions: CvSuggestion[] = [];
    const seen = new Set<string>();
    if (Array.isArray(raw.suggestions)) {
      for (const item of raw.suggestions) {
        if (typeof item !== 'object' || item === null) continue;
        const record = item as Record<string, unknown>;
        if (!isSection(record.section)) continue;
        const action =
          typeof record.action === 'string' ? record.action.trim() : '';
        const key = `${record.section}|${action.toLowerCase()}`;
        if (action.length === 0 || seen.has(key)) continue;
        seen.add(key);
        suggestions.push({ section: record.section, action });
        if (suggestions.length === MAX_ITEMS) break;
      }
    }
    return { strengths, suggestions };
  }
}
