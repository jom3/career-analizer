import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenaiService } from '../openai/openai.service';
import {
  CvDraft,
  CvDraftExperience,
  CvDraftSkill,
  CvDraftEducation,
  CvDraftCertification,
  CvDraftProject,
  CvDraftLanguage,
  SourceLanguage,
} from './cv-import.types';
import { Source } from '../generated/prisma/enums.js';

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
  'trabajo',
  'empresa',
  'idiomas',
  'resumen',
  'perfil',
  'responsabilidades',
];

const ENGLISH_STOPWORDS = [
  'the',
  'and',
  'experience',
  'skills',
  'education',
  'work',
  'company',
  'languages',
  'summary',
  'profile',
  'responsibilities',
  'position',
];

function detectLanguage(text: string): SourceLanguage {
  const lower = text.toLowerCase();
  let spanish = 0;
  let english = 0;
  for (const word of SPANISH_STOPWORDS) {
    if (lower.includes(word)) spanish++;
  }
  for (const word of ENGLISH_STOPWORDS) {
    if (lower.includes(word)) english++;
  }
  if (spanish === 0 && english === 0) return 'other';
  return spanish >= english ? 'es' : 'en';
}

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function nullableInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function nullableBool(value: unknown): boolean {
  return value === true;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

// Parsea el texto de un CV con la API de OpenAI usando structured outputs
// y devuelve un borrador relajado del perfil. Nunca inventa datos: si el
// texto no aporta evidencia, el campo queda null.
@Injectable()
export class CvParserService {
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

  async parse(
    text: string,
  ): Promise<{ draft: CvDraft; sourceLanguage: SourceLanguage }> {
    const sourceLanguage = detectLanguage(text);
    try {
      const completion =
        await this.openaiService.client.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: this.buildSystemPrompt(sourceLanguage),
            },
            {
              role: 'user',
              content: `Texto del CV:\n\n${text}`,
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'cv_draft',
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
    } catch {
      throw new BadGatewayException(
        'La IA no pudo interpretar el documento. Intenta de nuevo.',
      );
    }
  }

  private buildSystemPrompt(language: SourceLanguage): string {
    const es = language === 'es';
    const intro = es
      ? 'Sos un extractor de datos de currículums. Extraé únicamente la información que aparece explícitamente en el texto del CV.'
      : 'You are a resume data extractor. Extract only information that appears explicitly in the CV text.';
    const noInvent = es
      ? 'No inventes, no infieras datos que no estén escritos: empresas, fechas, títulos, certificaciones, tecnologías, logros ni datos de contacto.'
      : 'Never invent or infer data that is not written: companies, dates, titles, certifications, technologies, achievements, or contact details.';
    const nulls = es
      ? 'Si un dato no aparece o es incierto, devolvelo como null.'
      : 'If a piece of data is missing or uncertain, return it as null.';
    const levels = es
      ? 'Los niveles de habilidad (1-5) y de idiomas (A1-C2) solo se completan si el CV da evidencia (por ejemplo "avanzado", "fluido", "nativo", "proficient", "native"); si no, null.'
      : 'Skill levels (1-5) and language levels (A1-C2) must only be set when the CV gives evidence (e.g. "advanced", "fluent", "native", "proficient"); otherwise null.';
    const dates = es
      ? 'Las fechas se devuelven en formato YYYY-MM-01 (primer día del mes). Si el cargo o la formación dice "actual" o "presente", current=true y endDate=null.'
      : 'Dates must use the YYYY-MM-01 format (first day of the month). If a role or degree says "current" or "present", set current=true and endDate=null.';
    const extract = es
      ? 'Los contactos se devuelven solo si están escritos (teléfono, ubicación, sitio web, LinkedIn).'
      : 'Contact data must be returned only when written (phone, location, website, LinkedIn).';
    const cleanText = es
      ? 'Ignorá ligaduras residuales (ﬁ, ﬃ, ﬂ) o errores tipográficos del texto y transcribí los datos limpios. Respetá la grafía del CV tal cual (empresas, tecnologías, nombres), sin corregir ni inventar.'
      : 'Ignore residual ligatures (ﬁ, ﬃ, ﬂ) or typos in the text and transcribe the data cleanly. Reproduce the CV spelling as-is (companies, technologies, names), without correcting or inventing.';
    const noDuplicates = es
      ? 'No dupliques ítems: si el mismo dato aparece repetido (idéntico o casi-idéntico, p. ej. "TypeScript" y "Typescript", o "Full-stack" y "Full Stack"), devolvelo una sola vez, usando la variante más completa y legible.'
      : 'Do not duplicate items: if the same piece of data appears repeated (identical or nearly identical, e.g. "TypeScript" and "Typescript", or "Full-stack" and "Full Stack"), return it only once, using the most complete and readable variant.';
    return `${intro} ${noInvent} ${nulls} ${levels} ${dates} ${extract} ${cleanText} ${noDuplicates}`;
  }

  private buildDraftSchema(): Record<string, unknown> {
    const nullableString = { type: ['string', 'null'] };
    const nullableInteger = { type: ['integer', 'null'] };

    const experienceSchema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        company: nullableString,
        position: nullableString,
        location: nullableString,
        startDate: nullableString,
        endDate: nullableString,
        current: { type: 'boolean' },
        description: nullableString,
      },
      required: [
        'company',
        'position',
        'location',
        'startDate',
        'endDate',
        'current',
        'description',
      ],
    };

    const skillSchema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        level: nullableInteger,
      },
      required: ['name', 'level'],
    };

    const educationSchema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        degree: nullableString,
        institution: nullableString,
        field: nullableString,
        startDate: nullableString,
        endDate: nullableString,
        current: { type: 'boolean' },
        description: nullableString,
      },
      required: [
        'degree',
        'institution',
        'field',
        'startDate',
        'endDate',
        'current',
        'description',
      ],
    };

    const certificationSchema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: nullableString,
        issuer: nullableString,
        year: nullableInteger,
        url: nullableString,
      },
      required: ['name', 'issuer', 'year', 'url'],
    };

    const projectSchema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: nullableString,
        role: nullableString,
        description: nullableString,
        url: nullableString,
        techStack: { type: 'array', items: { type: 'string' } },
      },
      required: ['name', 'role', 'description', 'url', 'techStack'],
    };

    const languageSchema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        level: nullableString,
      },
      required: ['name', 'level'],
    };

    return {
      type: 'object',
      additionalProperties: false,
      properties: {
        headline: nullableString,
        phone: nullableString,
        location: nullableString,
        website: nullableString,
        linkedin: nullableString,
        summary: nullableString,
        experiences: { type: 'array', items: experienceSchema },
        skills: { type: 'array', items: skillSchema },
        education: { type: 'array', items: educationSchema },
        certifications: { type: 'array', items: certificationSchema },
        projects: { type: 'array', items: projectSchema },
        languages: { type: 'array', items: languageSchema },
      },
      required: [
        'headline',
        'phone',
        'location',
        'website',
        'linkedin',
        'summary',
        'experiences',
        'skills',
        'education',
        'certifications',
        'projects',
        'languages',
      ],
    };
  }

  private normalize(raw: Record<string, unknown>): CvDraft {
    return {
      headline: nonEmpty(nullableString(raw.headline)),
      phone: nonEmpty(nullableString(raw.phone)),
      location: nonEmpty(nullableString(raw.location)),
      website: nonEmpty(nullableString(raw.website)),
      linkedin: nonEmpty(nullableString(raw.linkedin)),
      summary: nonEmpty(nullableString(raw.summary)),
      experiences: this.normalizeExperiences(raw.experiences),
      skills: this.normalizeSkills(raw.skills),
      education: this.normalizeEducation(raw.education),
      certifications: this.normalizeCertifications(raw.certifications),
      projects: this.normalizeProjects(raw.projects),
      languages: this.normalizeLanguages(raw.languages),
    };
  }

  private normalizeExperiences(value: unknown): CvDraftExperience[] {
    if (!Array.isArray(value)) return [];
    const items = value.filter(
      (item) => typeof item === 'object' && item !== null,
    ) as Record<string, unknown>[];
    return items
      .map((item, index): CvDraftExperience => {
        const company = nonEmpty(nullableString(item.company));
        const position = nonEmpty(nullableString(item.position));
        return {
          company,
          position,
          location: nonEmpty(nullableString(item.location)),
          startDate: nonEmpty(nullableString(item.startDate)),
          endDate: nonEmpty(nullableString(item.endDate)),
          current: nullableBool(item.current),
          description: nonEmpty(nullableString(item.description)),
          source: Source.CV_IMPORT,
          sortOrder: index,
        };
      })
      .filter((item) => item.company !== null || item.position !== null);
  }

  private normalizeSkills(value: unknown): CvDraftSkill[] {
    if (!Array.isArray(value)) return [];
    const items = value.filter(
      (item) => typeof item === 'object' && item !== null,
    ) as Record<string, unknown>[];
    return items
      .map((item, index): CvDraftSkill => {
        const name = nonEmpty(nullableString(item.name));
        return {
          name: name ?? '',
          level: this.normalizeLevel(nullableInt(item.level)),
          source: Source.CV_IMPORT,
          sortOrder: index,
        };
      })
      .filter((item) => item.name.length > 0);
  }

  private normalizeEducation(value: unknown): CvDraftEducation[] {
    if (!Array.isArray(value)) return [];
    const items = value.filter(
      (item) => typeof item === 'object' && item !== null,
    ) as Record<string, unknown>[];
    return items
      .map((item, index): CvDraftEducation => {
        const degree = nonEmpty(nullableString(item.degree));
        const institution = nonEmpty(nullableString(item.institution));
        return {
          degree,
          institution,
          field: nonEmpty(nullableString(item.field)),
          startDate: nonEmpty(nullableString(item.startDate)),
          endDate: nonEmpty(nullableString(item.endDate)),
          current: nullableBool(item.current),
          description: nonEmpty(nullableString(item.description)),
          source: Source.CV_IMPORT,
          sortOrder: index,
        };
      })
      .filter((item) => item.degree !== null || item.institution !== null);
  }

  private normalizeCertifications(value: unknown): CvDraftCertification[] {
    if (!Array.isArray(value)) return [];
    const items = value.filter(
      (item) => typeof item === 'object' && item !== null,
    ) as Record<string, unknown>[];
    return items
      .map((item, index): CvDraftCertification => {
        const name = nonEmpty(nullableString(item.name));
        return {
          name,
          issuer: nonEmpty(nullableString(item.issuer)),
          year: nullableInt(item.year),
          url: nonEmpty(nullableString(item.url)),
          source: Source.CV_IMPORT,
          sortOrder: index,
        };
      })
      .filter((item) => item.name !== null);
  }

  private normalizeProjects(value: unknown): CvDraftProject[] {
    if (!Array.isArray(value)) return [];
    const items = value.filter(
      (item) => typeof item === 'object' && item !== null,
    ) as Record<string, unknown>[];
    return items
      .map((item, index): CvDraftProject => {
        const name = nonEmpty(nullableString(item.name));
        return {
          name,
          role: nonEmpty(nullableString(item.role)),
          description: nonEmpty(nullableString(item.description)),
          url: nonEmpty(nullableString(item.url)),
          techStack: stringArray(item.techStack),
          source: Source.CV_IMPORT,
          sortOrder: index,
        };
      })
      .filter((item) => item.name !== null);
  }

  private normalizeLanguages(value: unknown): CvDraftLanguage[] {
    if (!Array.isArray(value)) return [];
    const items = value.filter(
      (item) => typeof item === 'object' && item !== null,
    ) as Record<string, unknown>[];
    return items
      .map((item, index): CvDraftLanguage => {
        const name = nonEmpty(nullableString(item.name));
        return {
          name: name ?? '',
          level: nonEmpty(nullableString(item.level)),
          source: Source.CV_IMPORT,
          sortOrder: index,
        };
      })
      .filter((item) => item.name.length > 0);
  }

  private normalizeLevel(value: number | null): number | null {
    if (value === null) return null;
    return value >= 1 && value <= 5 ? value : null;
  }
}
