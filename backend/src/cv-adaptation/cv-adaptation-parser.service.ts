import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenaiService } from '../openai/openai.service';
import type { AdaptedProfileSnapshot } from './cv-adaptation.types';
import { FORBIDDEN_EXPERTISE_TERMS, LOW_SKILL_MAX } from './skill-level';
import type { SummaryFacts } from './cv-adaptation-summary';

export interface ExperienceRewrite {
  originalId: string;
  text: string;
}

export interface AdaptationResult {
  summary: string | null;
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
  summaryFacts: SummaryFacts;
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
            {
              role: 'user',
              content: `Hechos reales permitidos para el resumen:\n${JSON.stringify(input.summaryFacts)}`,
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
      'You adapt a candidate CV for a specific job so recruiters and ATS filters read it naturally.',
      'You receive the real candidate profile snapshot, the job offer, and a list of permitted facts for the summary.',
      'You produce TWO things: a professional summary and rewritten descriptions for existing experiences.',
      'Every rewritten description must reference an existing originalId from the profile snapshot. Never add, remove or reorder experiences; never invent companies, positions, dates, achievements, metrics, education, certifications, projects, languages or skills.',
      'Integrate the matched skills and offer keywords naturally into the prose. The result must sound written by a professional person: no keyword stuffing, no detached keyword lists.',
      'Never claim that the candidate has a missing skill: the matchedSkills list is the only truth about what the candidate can highlight.',
      'Keep every factual claim identical to the snapshot; only rephrase for clarity, relevance and natural keyword emphasis.',
      `The candidate profile includes each skill's level from 1 to 5 (1 = basic, 5 = expert). For a skill declared at level ${LOW_SKILL_MAX} or below, never claim mastery or expertise: avoid terms like ${FORBIDDEN_EXPERTISE_TERMS.join(', ')}. Describe only the real work done with neutral verbs ('worked with', 'used'), and never present a level 1-2 skill as a core strength.`,
      writeIn,
      'THE SUMMARY: write it ONLY from the "Hechos reales permitidos para el resumen" facts. Follow this structure in a single paragraph, in order, no bullets, 3-4 sentences, about 60-80 words:',
      '1. Professional role/title plus total years of experience (use role and years; if years is null, omit the years and mention only the role).',
      '2. Current work area or type (freelance / salaried / company), using workType and currentCompany if present; if both are null, skip this part.',
      '3. One standout project or achievement with its PURPOSE (the "why", not the "how"). State the purpose in at most 8-10 words: a single general-purpose phrase, never a step-by-step enumeration of features (avoid "generates X, analyzes Y, optimizes Z"). Use the featuredProject real description and metrics as source; never invent.',
      '4. 2-3 key technical skills woven into AN action, not detached (use featuredSkills only; never add skills outside the list). Integrate how the skills apply (e.g. across frontend, backend, databases) INSIDE this same skills sentence — do NOT dedicate a separate sentence to it.',
      '5. A closing with a transferable quality grounded ONLY in the quality evidence (adaptable-stacks: mention adapting across the given stacks; maintainable-code: focus on maintainable/scalable code; performance: focus on results/optimization). If quality is null, omit the closing.',
      'NEVER use first person ("I seek", "I am passionate", "I want to contribute") — the summary is descriptive. NEVER say the candidate is learning or plans to learn a skill ("committed to learning", "compromiso con el aprendizaje"). NEVER mention a skill level qualifier ("basic/intermediate knowledge of X") in the summary, and never mention skills below the featured list: they belong in the skills section, not the summary. Avoid empty generic phrases: a quality must be tied to how it is applied.',
    ].join(' ');
  }

  private buildAdaptationSchema(): Record<string, unknown> {
    return {
      type: 'object',
      additionalProperties: false,
      properties: {
        summary: { type: 'string' },
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
      required: ['summary', 'experienceDescriptions'],
    };
  }

  // Guardia determinista: descarta cualquier descripción que afirme un skill
  // faltante o invente tecnologías que no existen en el snapshot. La supervisión
  // del text basta porque los skills son tokens con nombre propio.
  private normalize(
    raw: Record<string, unknown>,
    missingSkills: string[],
  ): AdaptationResult | null {
    const summary = nonEmptyString(raw.summary);
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
    const cleanSummary =
      summary !== null &&
      !this.invalidSummary(summary) &&
      !forbidden.some((skill) => this.mentionsSkill(summary, skill))
        ? summary
        : null;
    return { summary: cleanSummary, experienceDescriptions: safe };
  }

  // El resumen se descarta si afirma una skill que la oferta pide y el perfil no
  // tiene (missing), o si promete aprender algo (nunca "learning"/"aprender" en
  // un resumen descriptivo). Mantenerlo descartado evita exageraciones en el
  // único texto que abre el CV.
  private invalidSummary(summary: string): boolean {
    const lower = summary.toLowerCase();
    const learningHints = ['learn', 'aprend', 'learning', 'learning about'];
    const promisesLearning = learningHints.some((token) =>
      lower.includes(token),
    );
    return promisesLearning;
  }

  private mentionsSkill(text: string, skillToken: string): boolean {
    if (skillToken.length === 0) {
      return false;
    }
    return text.toLowerCase().includes(skillToken);
  }
}
