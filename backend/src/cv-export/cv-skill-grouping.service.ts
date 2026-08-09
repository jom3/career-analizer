import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenaiService } from '../openai/openai.service';
import type { CvLang } from './cv-export.service';

export interface CvSkillGroup {
  label: string | null;
  skills: string[];
}

// Agrupa las habilidades del CV en 3-4 categorías (SPEC 13) usando el prompt de
// producto. El resultado pasa siempre por una guardia determinista: cada nombre
// debe existir verbatim en la lista provista (es solo presentación, la lista de
// verdad son las skills reales del perfil). Si la IA falla, se devuelve un solo
// párrafo con todas las skills: el formato nunca rompe la exportación.
@Injectable()
export class CvSkillGroupingService {
  private readonly model: string;

  constructor(
    configService: ConfigService,
    private readonly openaiService: OpenaiService,
  ) {
    this.model = configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
  }

  // Con pocas skills no tiene sentido categorizar: se devuelve un solo grupo.
  async group(skills: string[], lang: CvLang): Promise<CvSkillGroup[]> {
    const clean = skills
      .map((skill) => skill.trim())
      .filter((skill) => skill.length > 0);
    if (clean.length === 0) {
      return [];
    }
    if (clean.length < 4) {
      return [{ label: null, skills: clean }];
    }
    try {
      const completion =
        await this.openaiService.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: this.buildSystemPrompt(lang) },
            {
              role: 'user',
              content: `Skills del candidato:\n${JSON.stringify(clean)}`,
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'skill_groups',
              strict: true,
              schema: this.buildSchema(),
            },
          },
        });
      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('empty response');
      }
      const parsed = JSON.parse(content) as Record<string, unknown>;
      return this.normalizeGroups(parsed, clean);
    } catch (error) {
      console.error('OpenAI skill grouping failed:', error);
      return [{ label: null, skills: clean }];
    }
  }

  private buildSystemPrompt(lang: CvLang): string {
    const examples =
      lang === 'es'
        ? 'Lenguajes y Frameworks, Bases de Datos, Herramientas y Otros'
        : 'Languages and Frameworks, Databases, Tools and Others';
    return [
      'You receive the Skills section of a CV as a vertical list (one skill per line), which takes too much space and is risky for ATS systems because a page break can join two words (e.g. "Docker" and "Jest" become "DockerJest").',
      'Rewrite this skills list in paragraph format, grouped by categories, with skills separated by commas within each category.',
      `Use 3-4 logical categories (e.g. ${examples}).`,
      'Keep the EXACT name of each technology: never abbreviate, translate or reword a technology.',
      'You may only group the skills present in the provided list. Never add, merge or invent new skills.',
      'Every skill from the provided list must appear in exactly one category; each category must contain at least one skill.',
      `Write the category labels in ${lang === 'es' ? 'Spanish' : 'English'}.`,
      'No tables, no columns, no icons, no line breaks between individual skills — only commas.',
    ].join(' ');
  }

  private buildSchema(): Record<string, unknown> {
    return {
      type: 'object',
      additionalProperties: false,
      properties: {
        categories: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              label: { type: 'string' },
              skills: { type: 'array', items: { type: 'string' } },
            },
            required: ['label', 'skills'],
          },
        },
      },
      required: ['categories'],
    };
  }

  // Guardia determinista: filtra a los nombres reales, conserva el casing y el
  // orden original, y agrega al final cualquier skill que la IA haya omitido.
  private normalizeGroups(
    raw: Record<string, unknown>,
    allowed: string[],
  ): CvSkillGroup[] {
    if (!Array.isArray(raw.categories)) {
      return [{ label: null, skills: allowed }];
    }

    const allowedLower = new Map(
      allowed.map((name) => [name.toLowerCase(), name]),
    );
    const groups: CvSkillGroup[] = [];
    const used = new Set<string>();

    for (const rawGroup of raw.categories) {
      if (typeof rawGroup !== 'object' || rawGroup === null) {
        continue;
      }
      const record = rawGroup as Record<string, unknown>;
      if (typeof record.skills !== 'string' && !Array.isArray(record.skills)) {
        continue;
      }
      const label =
        typeof record.label === 'string' && record.label.trim().length > 0
          ? record.label.trim()
          : null;
      const skills = (Array.isArray(record.skills) ? record.skills : [])
        .filter((skill): skill is string => typeof skill === 'string')
        .map((skill) => skill.trim())
        .filter((skill) => allowedLower.has(skill.toLowerCase()))
        .map((skill) => allowedLower.get(skill.toLowerCase())!)
        .filter((skill) => {
          if (used.has(skill.toLowerCase())) {
            return false;
          }
          used.add(skill.toLowerCase());
          return true;
        });
      if (skills.length > 0) {
        groups.push({ label, skills });
      }
    }

    const missed = allowed.filter((name) => !used.has(name.toLowerCase()));
    if (missed.length > 0) {
      groups.push({ label: null, skills: missed });
    }

    return groups.length > 0 ? groups : [{ label: null, skills: allowed }];
  }
}
