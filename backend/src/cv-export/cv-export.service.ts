import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import pdfMake from 'pdfmake';
import vfsFonts from 'pdfmake/build/vfs_fonts';
import { Content, TCreatedPdf, TDocumentDefinitions } from 'pdfmake/interfaces';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { selectLang, selectLangList, UiLang } from '../i18n/ui-lang';
import {
  CvSkillGroupingService,
  type CvSkillGroup,
} from './cv-skill-grouping.service';

export type CvLang = 'es' | 'en';

export interface CvExperience {
  company: string;
  position: string;
  location?: string;
  startDate?: Date;
  endDate?: Date;
  current: boolean;
  description?: string;
  metrics?: string[];
}

export interface CvSkill {
  name: string;
  level: number;
}

export interface CvEducation {
  degree: string;
  institution: string;
  field?: string;
  startDate?: Date;
  endDate?: Date;
  current: boolean;
  description?: string;
}

export interface CvCertification {
  name: string;
  issuer?: string;
  year?: number;
}

export interface CvProject {
  name: string;
  role?: string;
  description?: string;
  techStack: string[];
  metrics?: string[];
}

export interface CvLanguage {
  name: string;
  level: string;
}

export interface CvData {
  name: string;
  email: string;
  headline?: string;
  phone?: string;
  location?: string;
  website?: string;
  linkedin?: string;
  summary?: string;
  experiences: CvExperience[];
  skills: CvSkill[];
  skillGroups?: CvSkillGroup[];
  education: CvEducation[];
  certifications: CvCertification[];
  projects: CvProject[];
  languages: CvLanguage[];
}

const profileInclude = {
  experiences: { orderBy: { sortOrder: 'asc' as const } },
  skills: { orderBy: { sortOrder: 'asc' as const } },
  education: { orderBy: { sortOrder: 'asc' as const } },
  certifications: { orderBy: { sortOrder: 'asc' as const } },
  projects: { orderBy: { sortOrder: 'asc' as const } },
  languages: { orderBy: { sortOrder: 'asc' as const } },
} satisfies Prisma.ProfileInclude;

const sectionTitles: Record<CvLang, Record<string, string>> = {
  es: {
    summary: 'Resumen',
    experience: 'Experiencia',
    skills: 'Habilidades',
    education: 'Educación',
    certifications: 'Certificaciones',
    projects: 'Proyectos',
    languages: 'Idiomas',
  },
  en: {
    summary: 'Summary',
    experience: 'Experience',
    skills: 'Skills',
    education: 'Education',
    certifications: 'Certifications',
    projects: 'Projects',
    languages: 'Languages',
  },
};

const robotoFonts = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
};

interface PdfMakeServer {
  virtualfs: {
    existsSync(path: string): boolean;
    writeFileSync(path: string, content: string, encoding: string): void;
  };
  setFonts(fonts: Record<string, unknown>): void;
  createPdf(doc: TDocumentDefinitions): TCreatedPdf;
}

const pdfMakeServer = pdfMake as unknown as PdfMakeServer;

let fontsLoaded = false;

function ensureFonts(): void {
  if (fontsLoaded) {
    return;
  }
  for (const [name, content] of Object.entries(vfsFonts)) {
    pdfMakeServer.virtualfs.writeFileSync(name, content, 'base64');
  }
  pdfMakeServer.setFonts(robotoFonts);
  fontsLoaded = true;
}

function formatMonthYear(date?: Date | null): string | null {
  if (!date) {
    return null;
  }
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${month}/${date.getUTCFullYear()}`;
}

function formatDateRange(
  start?: Date | null,
  end?: Date | null,
  current = false,
  lang: CvLang = 'es',
): string {
  const presentLabel = lang === 'es' ? 'Actualidad' : 'Present';
  const startLabel = formatMonthYear(start);
  const endLabel = current ? presentLabel : formatMonthYear(end);
  if (!startLabel && !endLabel) {
    return '';
  }
  return `${startLabel ?? '—'} — ${endLabel ?? '—'}`;
}

@Injectable()
export class CvExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly skillGrouping: CvSkillGroupingService,
  ) {}

  async loadCvData(userId: string, targetLang: UiLang = 'es'): Promise<CvData> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        profile: { include: profileInclude },
      },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const profile = user.profile;
    return {
      name: user.name,
      email: user.email,
      headline:
        selectLang(profile?.headlineEs, profile?.headlineEn, targetLang) ??
        profile?.headline ??
        undefined,
      phone: profile?.phone ?? undefined,
      location:
        selectLang(profile?.locationEs, profile?.locationEn, targetLang) ??
        profile?.location ??
        undefined,
      website: profile?.website ?? undefined,
      linkedin: profile?.linkedin ?? undefined,
      summary:
        selectLang(profile?.summaryEs, profile?.summaryEn, targetLang) ??
        profile?.summary ??
        undefined,
      experiences: (profile?.experiences ?? [])
        .filter((item) => item.company && item.position)
        .map((item) => ({
          company: item.company,
          position:
            selectLang(item.positionEs, item.positionEn, targetLang) ??
            item.position,
          location:
            selectLang(item.locationEs, item.locationEn, targetLang) ??
            item.location ??
            undefined,
          startDate: item.startDate ?? undefined,
          endDate: item.endDate ?? undefined,
          current: item.current,
          description:
            selectLang(item.descriptionEs, item.descriptionEn, targetLang) ??
            item.description ??
            undefined,
          metrics:
            selectLangList(item.metricsEs, item.metricsEn, targetLang) ??
            item.metrics,
        })),
      skills: (profile?.skills ?? [])
        .filter((item) => item.name)
        .map((item) => ({ name: item.name, level: item.level })),
      education: (profile?.education ?? [])
        .filter((item) => item.degree && item.institution)
        .map((item) => ({
          degree:
            selectLang(item.degreeEs, item.degreeEn, targetLang) ?? item.degree,
          institution:
            selectLang(item.institutionEs, item.institutionEn, targetLang) ??
            item.institution,
          field:
            selectLang(item.fieldEs, item.fieldEn, targetLang) ??
            item.field ??
            undefined,
          startDate: item.startDate ?? undefined,
          endDate: item.endDate ?? undefined,
          current: item.current,
          description:
            selectLang(item.descriptionEs, item.descriptionEn, targetLang) ??
            item.description ??
            undefined,
        })),
      certifications: (profile?.certifications ?? [])
        .filter((item) => item.name)
        .map((item) => ({
          name: selectLang(item.nameEs, item.nameEn, targetLang) ?? item.name,
          issuer:
            selectLang(item.issuerEs, item.issuerEn, targetLang) ??
            item.issuer ??
            undefined,
          year: item.year ?? undefined,
        })),
      projects: (profile?.projects ?? [])
        .filter((item) => item.name)
        .map((item) => ({
          name: selectLang(item.nameEs, item.nameEn, targetLang) ?? item.name,
          role:
            selectLang(item.roleEs, item.roleEn, targetLang) ??
            item.role ??
            undefined,
          description:
            selectLang(item.descriptionEs, item.descriptionEn, targetLang) ??
            item.description ??
            undefined,
          techStack: item.techStack,
          metrics:
            selectLangList(item.metricsEs, item.metricsEn, targetLang) ??
            item.metrics,
        })),
      languages: (profile?.languages ?? [])
        .filter((item) => item.name)
        .map((item) => ({
          name: selectLang(item.nameEs, item.nameEn, targetLang) ?? item.name,
          level: item.level,
        })),
    };
  }

  async buildPdf(data: CvData, lang: CvLang): Promise<Buffer> {
    ensureFonts();
    const skillGroups = await this.resolveSkillGroups(data, lang);
    const doc: TDocumentDefinitions = {
      content: this.buildPdfContent({ ...data, skillGroups }, lang),
      defaultStyle: { font: 'Roboto', fontSize: 10 },
      styles: {
        name: { fontSize: 20, bold: true },
        headline: { fontSize: 12, color: '#444444', margin: [0, 2, 0, 6] },
        contact: { fontSize: 9, color: '#555555', margin: [0, 0, 0, 4] },
        sectionTitle: { fontSize: 12, bold: true, margin: [0, 10, 0, 4] },
        itemTitle: { fontSize: 11, bold: true, margin: [0, 4, 0, 1] },
        itemMeta: {
          fontSize: 9,
          italics: true,
          color: '#555555',
          margin: [0, 0, 0, 2],
        },
        body: { fontSize: 10, margin: [0, 0, 0, 4] },
      },
    };
    return pdfMakeServer.createPdf(doc).getBuffer();
  }

  async buildDocx(data: CvData, lang: CvLang): Promise<Buffer> {
    const skillGroups = await this.resolveSkillGroups(data, lang);
    const doc = new Document({
      sections: [
        { children: this.buildDocxContent({ ...data, skillGroups }, lang) },
      ],
    });
    return Packer.toBuffer(doc);
  }

  // Agrupa las skills en categorías de presentación (SPEC 13). Si el dato ya
  // trae los grupos (CV adaptado), se respetan tal cual; en el CV base se pide
  // la agrupación a la IA con guardia determinista.
  private async resolveSkillGroups(
    data: CvData,
    lang: CvLang,
  ): Promise<CvSkillGroup[] | undefined> {
    if (data.skillGroups && data.skillGroups.length > 0) {
      return data.skillGroups;
    }
    if (data.skills.length === 0) {
      return undefined;
    }
    return this.skillGrouping.group(
      data.skills.map((item) => item.name),
      lang,
    );
  }

  private buildPdfContent(data: CvData, lang: CvLang): Content[] {
    const titles = sectionTitles[lang];
    const content: Content[] = [{ text: data.name, style: 'name' }];

    if (data.headline) {
      content.push({ text: data.headline, style: 'headline' });
    }

    const contact = [
      data.email,
      data.phone,
      data.location,
      data.website,
      data.linkedin,
    ]
      .filter((part): part is string => Boolean(part))
      .join('  |  ');
    if (contact) {
      content.push({ text: contact, style: 'contact' });
    }

    if (data.summary) {
      content.push({ text: titles.summary, style: 'sectionTitle' });
      content.push(...this.pdfBodyParagraphs(data.summary));
    }

    if (data.experiences.length > 0) {
      content.push({ text: titles.experience, style: 'sectionTitle' });
      for (const item of data.experiences) {
        const meta = [item.company, item.location]
          .filter((part): part is string => Boolean(part))
          .join('  |  ');
        const range = formatDateRange(
          item.startDate,
          item.endDate,
          item.current,
          lang,
        );
        content.push(
          { text: item.position, style: 'itemTitle' },
          {
            text: [meta, range].filter(Boolean).join('  ·  '),
            style: 'itemMeta',
          },
        );
        if (item.description) {
          content.push(...this.pdfBodyParagraphs(item.description));
        }
        if (item.metrics && item.metrics.length > 0) {
          content.push(...this.pdfMetricsBullets(item.metrics));
        }
      }
    }

    if (data.skills.length > 0) {
      content.push({ text: titles.skills, style: 'sectionTitle' });
      content.push(...this.pdfSkillParagraphs(data.skillGroups, data.skills));
    }

    if (data.education.length > 0) {
      content.push({ text: titles.education, style: 'sectionTitle' });
      for (const item of data.education) {
        const meta: string[] = [];
        if (item.field) {
          meta.push(item.field);
        }
        const range = formatDateRange(
          item.startDate,
          item.endDate,
          item.current,
          lang,
        );
        if (range) {
          meta.push(range);
        }
        content.push({
          text: `${item.degree} — ${item.institution}`,
          style: 'itemTitle',
        });
        if (meta.length > 0) {
          content.push({ text: meta.join('  |  '), style: 'itemMeta' });
        }
        if (item.description) {
          content.push(...this.pdfBodyParagraphs(item.description));
        }
      }
    }

    if (data.certifications.length > 0) {
      content.push({ text: titles.certifications, style: 'sectionTitle' });
      for (const item of data.certifications) {
        const parts = [item.name];
        if (item.issuer) {
          parts.push(item.issuer);
        }
        if (item.year) {
          parts.push(String(item.year));
        }
        content.push({ text: parts.join(' — '), style: 'body' });
      }
    }

    if (data.projects.length > 0) {
      content.push({ text: titles.projects, style: 'sectionTitle' });
      for (const item of data.projects) {
        const title = item.role ? `${item.name} — ${item.role}` : item.name;
        content.push({ text: title, style: 'itemTitle' });
        if (item.techStack.length > 0) {
          content.push({
            text: item.techStack.join(', '),
            style: 'itemMeta',
          });
        }
        if (item.description) {
          content.push(...this.pdfBodyParagraphs(item.description));
        }
        if (item.metrics && item.metrics.length > 0) {
          content.push(...this.pdfMetricsBullets(item.metrics));
        }
      }
    }

    if (data.languages.length > 0) {
      content.push({ text: titles.languages, style: 'sectionTitle' });
      content.push(
        ...data.languages.map((item) => ({
          text: `${item.name} (${item.level})`,
          style: 'body',
        })),
      );
    }

    return content;
  }

  private buildDocxContent(data: CvData, lang: CvLang): Paragraph[] {
    const titles = sectionTitles[lang];
    const children: Paragraph[] = [
      new Paragraph({
        children: [new TextRun({ text: data.name, bold: true, size: 40 })],
      }),
    ];

    if (data.headline) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: data.headline, italics: true, size: 24 }),
          ],
          spacing: { after: 120 },
        }),
      );
    }

    const contact = [
      data.email,
      data.phone,
      data.location,
      data.website,
      data.linkedin,
    ]
      .filter((part): part is string => Boolean(part))
      .join('  |  ');
    if (contact) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: contact, size: 18 })],
          spacing: { after: 120 },
        }),
      );
    }

    if (data.summary) {
      children.push(this.docxSectionTitle(titles.summary));
      children.push(...this.docxBodyParagraphs(data.summary));
    }

    if (data.experiences.length > 0) {
      children.push(this.docxSectionTitle(titles.experience));
      for (const item of data.experiences) {
        const meta = [item.company, item.location]
          .filter((part): part is string => Boolean(part))
          .join('  |  ');
        const range = formatDateRange(
          item.startDate,
          item.endDate,
          item.current,
          lang,
        );
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: item.position, bold: true, size: 22 }),
            ],
            spacing: { before: 120, after: 40 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: [meta, range].filter(Boolean).join('  ·  '),
                italics: true,
                size: 18,
              }),
            ],
            spacing: { after: 80 },
          }),
        );
        if (item.description) {
          children.push(...this.docxBodyParagraphs(item.description));
        }
        if (item.metrics && item.metrics.length > 0) {
          children.push(...this.docxMetricsBullets(item.metrics));
        }
      }
    }

    if (data.skills.length > 0) {
      children.push(this.docxSectionTitle(titles.skills));
      children.push(...this.docxSkillParagraphs(data.skillGroups, data.skills));
    }

    if (data.education.length > 0) {
      children.push(this.docxSectionTitle(titles.education));
      for (const item of data.education) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${item.degree} — ${item.institution}`,
                bold: true,
                size: 22,
              }),
            ],
            spacing: { before: 120, after: 40 },
          }),
        );
        const meta: string[] = [];
        if (item.field) {
          meta.push(item.field);
        }
        const range = formatDateRange(
          item.startDate,
          item.endDate,
          item.current,
          lang,
        );
        if (range) {
          meta.push(range);
        }
        if (meta.length > 0) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: meta.join('  |  '),
                  italics: true,
                  size: 18,
                }),
              ],
              spacing: { after: 80 },
            }),
          );
        }
        if (item.description) {
          children.push(...this.docxBodyParagraphs(item.description));
        }
      }
    }

    if (data.certifications.length > 0) {
      children.push(this.docxSectionTitle(titles.certifications));
      for (const item of data.certifications) {
        const parts = [item.name];
        if (item.issuer) {
          parts.push(item.issuer);
        }
        if (item.year) {
          parts.push(String(item.year));
        }
        children.push(this.docxBody(parts.join(' — ')));
      }
    }

    if (data.projects.length > 0) {
      children.push(this.docxSectionTitle(titles.projects));
      for (const item of data.projects) {
        const title = item.role ? `${item.name} — ${item.role}` : item.name;
        children.push(
          new Paragraph({
            children: [new TextRun({ text: title, bold: true, size: 22 })],
            spacing: { before: 120, after: 40 },
          }),
        );
        if (item.techStack.length > 0) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: item.techStack.join(', '),
                  italics: true,
                  size: 18,
                }),
              ],
              spacing: { after: 80 },
            }),
          );
        }
        if (item.description) {
          children.push(...this.docxBodyParagraphs(item.description));
        }
        if (item.metrics && item.metrics.length > 0) {
          children.push(...this.docxMetricsBullets(item.metrics));
        }
      }
    }

    if (data.languages.length > 0) {
      children.push(this.docxSectionTitle(titles.languages));
      children.push(
        ...data.languages.map((item) =>
          this.docxBody(`${item.name} (${item.level})`),
        ),
      );
    }

    return children;
  }

  private docxSectionTitle(text: string): Paragraph {
    return new Paragraph({
      children: [new TextRun({ text, bold: true, size: 28 })],
      spacing: { before: 280, after: 120 },
    });
  }

  // Sección de habilidades en formato párrafo agrupado por categorías (SPEC 13):
  // un párrafo por categoría con las skills separadas por comas. Si no hay
  // grupos (fallback), un único párrafo con todas las skills: se evita la
  // línea-por-línea que los ATS pueden partir juntando dos palabras.
  private pdfSkillParagraphs(
    skillGroups: CvSkillGroup[] | undefined,
    skills: CvSkill[],
  ): Content[] {
    return this.skillGroupLines(skillGroups, skills).map((line) => ({
      text: line,
      style: 'body',
    }));
  }

  private docxSkillParagraphs(
    skillGroups: CvSkillGroup[] | undefined,
    skills: CvSkill[],
  ): Paragraph[] {
    return this.skillGroupLines(skillGroups, skills).map((line) =>
      this.docxBody(line),
    );
  }

  private skillGroupLines(
    skillGroups: CvSkillGroup[] | undefined,
    skills: CvSkill[],
  ): string[] {
    const groups = skillGroups && skillGroups.length > 0 ? skillGroups : null;
    if (!groups) {
      return [skills.map((item) => item.name).join(', ')];
    }
    return groups.map((group) =>
      group.label
        ? `${group.label}: ${group.skills.join(', ')}`
        : group.skills.join(', '),
    );
  }

  private pdfMetricsBullets(metrics: string[]): Content[] {
    return metrics.map((metric) => ({ text: `• ${metric}`, style: 'body' }));
  }

  private docxMetricsBullets(metrics: string[]): Paragraph[] {
    return metrics.map((metric) => this.docxBody(`• ${metric}`));
  }

  // Divide un texto multilínea en párrafos para que los saltos de línea se
  // preserven en la exportación (pdfmake/docx colapsan \n a un espacio).
  private pdfBodyParagraphs(text: string): Content[] {
    return this.nonEmptyLines(text).map((line) => ({
      text: line,
      style: 'body',
    }));
  }

  private docxBodyParagraphs(text: string): Paragraph[] {
    return this.nonEmptyLines(text).map((line) => this.docxBody(line));
  }

  private nonEmptyLines(text: string): string[] {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  private docxBody(text: string): Paragraph {
    return new Paragraph({
      children: [new TextRun({ text, size: 22 })],
      spacing: { after: 80 },
    });
  }
}
