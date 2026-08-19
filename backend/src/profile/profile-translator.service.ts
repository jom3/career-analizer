import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenaiService } from '../openai/openai.service';
import type { ProfileWithCollections } from './profile.service';

export type Lang = 'es' | 'en';

export interface ProfileTranslationInput {
  profile: ProfileWithCollections;
  sourceLang: Lang;
  targetLang: Lang;
}

interface ProfileFields {
  headline: string | null;
  location: string | null;
  summary: string | null;
}

interface ExperienceFields {
  id: string;
  position: string | null;
  location: string | null;
  description: string | null;
  metrics: string[] | null;
}

interface EducationFields {
  id: string;
  degree: string | null;
  institution: string | null;
  field: string | null;
  description: string | null;
}

interface CertificationFields {
  id: string;
  name: string | null;
  issuer: string | null;
}

interface ProjectFields {
  id: string;
  name: string | null;
  role: string | null;
  description: string | null;
  metrics: string[] | null;
}

interface LanguageFields {
  id: string;
  name: string | null;
}

export interface ProfileTranslationResult {
  profile: ProfileFields;
  experiences: ExperienceFields[];
  education: EducationFields[];
  certifications: CertificationFields[];
  projects: ProjectFields[];
  languages: LanguageFields[];
}

type FieldValue = string | string[] | null;
type FieldReader = (record: Record<string, unknown>) => FieldValue;

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function nonEmptyStrings(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.filter(
    (item): item is string =>
      typeof item === 'string' && item.trim().length > 0,
  );
  return items.length > 0 ? items : null;
}

// Traduce los campos de texto del perfil del idioma de origen al destino con la
// API de OpenAI (structured outputs). Adaptación natural profesional, sin
// traducir nombres propios y sin inventar datos. Devuelve solo los campos del
// idioma destino.
@Injectable()
export class ProfileTranslatorService {
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

  async translate(
    input: ProfileTranslationInput,
  ): Promise<ProfileTranslationResult> {
    const payload = this.buildPayload(input);
    try {
      const completion =
        await this.openaiService.client.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: this.buildSystemPrompt(input),
            },
            {
              role: 'user',
              content: `Perfil a traducir (idioma de origen ${input.sourceLang}):\n${JSON.stringify(payload)}`,
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'profile_translation',
              strict: true,
              schema: this.buildSchema(),
            },
          },
        });
      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('empty translation response');
      }
      const raw = JSON.parse(content) as Record<string, unknown>;
      const result = this.normalize(raw, payload);
      if (!result) {
        throw new Error('invalid translation shape');
      }
      return result;
    } catch (error) {
      console.error('OpenAI profile translation failed:', error);
      throw new BadGatewayException(
        'La IA no pudo traducir el perfil. Intenta de nuevo.',
      );
    }
  }

  private buildSystemPrompt(input: ProfileTranslationInput): string {
    const targetName = input.targetLang === 'es' ? 'Spanish' : 'English';
    const sourceName = input.sourceLang === 'es' ? 'Spanish' : 'English';
    return [
      `You translate a candidate's professional profile from ${sourceName} into natural, professional ${targetName}.`,
      'Adapt the text naturally and professionally; do NOT translate literally. Keep the tone human, specific and convincing.',
      'Translate ONLY the text fields provided. Never add, remove, reorder or invent experiences, education, certifications, projects, languages, skills, companies, positions, degrees, achievements, metrics or any data that is not present in the input. Only translate what exists.',
      'Do NOT translate proper nouns: company names, institution names, position titles that are proper nouns, certification names, project names, skill names, technologies, techStack, CEFR levels (A1-C2), URLs, email addresses, city names or product names. Keep them verbatim.',
      'Translate descriptive prose (descriptions, summaries, metric phrasing, role descriptions) naturally. For metrics, translate the prose but keep any numbers, percentages and units exactly as they are.',
      'If a source field is empty or null, return null for that field. If you are not confident a term is a proper noun, keep it verbatim rather than translating it.',
      'Return ONLY the requested JSON structure with the translated fields in the target language.',
    ].join(' ');
  }

  private buildSchema(): Record<string, unknown> {
    const stringField = { type: ['string', 'null'] };
    const stringArrayField = {
      type: ['array', 'null'],
      items: { type: 'string' },
    };
    const itemSchema = (
      fields: Record<string, unknown>,
    ): Record<string, unknown> => ({
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { type: 'string' },
        ...fields,
      },
      required: ['id', ...Object.keys(fields)],
    });
    return {
      type: 'object',
      additionalProperties: false,
      properties: {
        profile: {
          type: 'object',
          additionalProperties: false,
          properties: {
            headline: stringField,
            location: stringField,
            summary: stringField,
          },
          required: ['headline', 'location', 'summary'],
        },
        experiences: {
          type: 'array',
          items: itemSchema({
            position: stringField,
            location: stringField,
            description: stringField,
            metrics: stringArrayField,
          }),
        },
        education: {
          type: 'array',
          items: itemSchema({
            degree: stringField,
            institution: stringField,
            field: stringField,
            description: stringField,
          }),
        },
        certifications: {
          type: 'array',
          items: itemSchema({
            name: stringField,
            issuer: stringField,
          }),
        },
        projects: {
          type: 'array',
          items: itemSchema({
            name: stringField,
            role: stringField,
            description: stringField,
            metrics: stringArrayField,
          }),
        },
        languages: {
          type: 'array',
          items: itemSchema({
            name: stringField,
          }),
        },
      },
      required: [
        'profile',
        'experiences',
        'education',
        'certifications',
        'projects',
        'languages',
      ],
    };
  }

  // Construye el payload que se envía a la IA: solo los campos de texto del
  // idioma de origen (con fallback a la columna única sincronizada).
  private buildPayload(
    input: ProfileTranslationInput,
  ): ProfileTranslationResult {
    const { profile, sourceLang } = input;
    const col = (field: string): string =>
      sourceLang === 'es' ? `${field}Es` : `${field}En`;
    const text = (
      record: Record<string, unknown>,
      field: string,
    ): string | null => nonEmptyString(record[col(field)] ?? record[field]);
    const texts = (
      record: Record<string, unknown>,
      field: string,
    ): string[] | null => {
      const localized = record[col(field)];
      if (Array.isArray(localized) && localized.length > 0) {
        return nonEmptyStrings(localized);
      }
      return nonEmptyStrings(record[field]);
    };

    return {
      profile: {
        headline: text(profile, 'headline'),
        location: text(profile, 'location'),
        summary: text(profile, 'summary'),
      },
      experiences: profile.experiences.map((item) => ({
        id: item.id,
        position: text(item, 'position'),
        location: text(item, 'location'),
        description: text(item, 'description'),
        metrics: texts(item, 'metrics'),
      })),
      education: profile.education.map((item) => ({
        id: item.id,
        degree: text(item, 'degree'),
        institution: text(item, 'institution'),
        field: text(item, 'field'),
        description: text(item, 'description'),
      })),
      certifications: profile.certifications.map((item) => ({
        id: item.id,
        name: text(item, 'name'),
        issuer: text(item, 'issuer'),
      })),
      projects: profile.projects.map((item) => ({
        id: item.id,
        name: text(item, 'name'),
        role: text(item, 'role'),
        description: text(item, 'description'),
        metrics: texts(item, 'metrics'),
      })),
      languages: profile.languages.map((item) => ({
        id: item.id,
        name: text(item, 'name'),
      })),
    };
  }

  // Guardia determinista: valida la forma y descarta campos vacíos e ítems cuyo
  // id no exista en el origen (la IA no puede inventar entidades). Los campos
  // no traducibles (skills, techStack, CEFR, URLs) no están en el schema, así
  // que se conservan verbatim simplemente por no tocarse.
  private normalize(
    raw: Record<string, unknown>,
    payload: ProfileTranslationResult,
  ): ProfileTranslationResult | null {
    const rawProfile = raw.profile;
    if (typeof rawProfile !== 'object' || rawProfile === null) return null;
    const profileRecord = rawProfile as Record<string, unknown>;
    const profile: ProfileFields = {
      headline: nonEmptyString(profileRecord.headline),
      location: nonEmptyString(profileRecord.location),
      summary: nonEmptyString(profileRecord.summary),
    };

    const stringReader =
      (key: string): FieldReader =>
      (record) =>
        nonEmptyString(record[key]);
    const arrayReader =
      (key: string): FieldReader =>
      (record) =>
        nonEmptyStrings(record[key]);

    const experiences = this.normalizeItems(
      raw.experiences,
      new Set(payload.experiences.map((e) => e.id)),
      [
        ['position', stringReader('position')],
        ['location', stringReader('location')],
        ['description', stringReader('description')],
        ['metrics', arrayReader('metrics')],
      ],
    );
    const education = this.normalizeItems(
      raw.education,
      new Set(payload.education.map((e) => e.id)),
      [
        ['degree', stringReader('degree')],
        ['institution', stringReader('institution')],
        ['field', stringReader('field')],
        ['description', stringReader('description')],
      ],
    );
    const certifications = this.normalizeItems(
      raw.certifications,
      new Set(payload.certifications.map((c) => c.id)),
      [
        ['name', stringReader('name')],
        ['issuer', stringReader('issuer')],
      ],
    );
    const projects = this.normalizeItems(
      raw.projects,
      new Set(payload.projects.map((p) => p.id)),
      [
        ['name', stringReader('name')],
        ['role', stringReader('role')],
        ['description', stringReader('description')],
        ['metrics', arrayReader('metrics')],
      ],
    );
    const languages = this.normalizeItems(
      raw.languages,
      new Set(payload.languages.map((l) => l.id)),
      [['name', stringReader('name')]],
    );

    if (
      experiences === null ||
      education === null ||
      certifications === null ||
      projects === null ||
      languages === null
    ) {
      return null;
    }

    return {
      profile,
      experiences: experiences as unknown as ExperienceFields[],
      education: education as unknown as EducationFields[],
      certifications: certifications as unknown as CertificationFields[],
      projects: projects as unknown as ProjectFields[],
      languages: languages as unknown as LanguageFields[],
    };
  }

  private normalizeItems(
    raw: unknown,
    expectedIds: Set<string>,
    fields: Array<[string, FieldReader]>,
  ): Array<Record<string, unknown>> | null {
    if (!Array.isArray(raw)) return null;
    const result: Array<Record<string, unknown>> = [];
    for (const item of raw) {
      if (typeof item !== 'object' || item === null) return null;
      const record = item as Record<string, unknown>;
      const id = nonEmptyString(record.id);
      if (id === null || !expectedIds.has(id)) continue;
      const out: Record<string, unknown> = { id };
      for (const [key, read] of fields) {
        const value = read(record);
        if (value !== null) out[key] = value;
      }
      result.push(out);
    }
    return result;
  }
}
