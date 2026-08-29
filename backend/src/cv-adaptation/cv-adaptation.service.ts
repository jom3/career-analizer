import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import type { AdaptedCv } from '../generated/prisma/client';
import { JobLevel } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service';
import {
  profileInclude,
  type ProfileWithCollections,
} from '../profile/profile.service';
import { profileFingerprint, profileSnapshot } from '../job-match/profile-util';
import { cleanStringArray } from '../job-analysis/token-clean';
import { CvExportService, type CvData } from '../cv-export/cv-export.service';
import { UiLang } from '../i18n/ui-lang';
import { localizeProfile } from '../profile/localize-profile';
import {
  adaptedProfileSnapshot,
  applyRewrites,
  buildBaseContent,
  type AdaptedCvContent,
} from './cv-adaptation.types';
import {
  CvAdaptationParserService,
  type AdaptationInput,
} from './cv-adaptation-parser.service';
import { buildSummaryFacts } from './cv-adaptation-summary';
import type { AdaptedCvDto } from './dto/cv-adaptation.dto';
import type { JobOfferDraft } from '../job-analysis/job-analysis.types';
import type { JobMatchGap } from '../job-match/dto/job-match.dto';

function emptyProfile(): ProfileWithCollections {
  return {
    id: '',
    userId: '',
    headline: null,
    phone: null,
    location: null,
    website: null,
    linkedin: null,
    summary: null,
    headlineEs: null,
    headlineEn: null,
    locationEs: null,
    locationEn: null,
    summaryEs: null,
    summaryEn: null,
    source: 'USER',
    experiences: [],
    skills: [],
    education: [],
    certifications: [],
    projects: [],
    languages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function toDate(value?: string): Date | undefined {
  return value ? new Date(value) : undefined;
}

function contentToCvData(
  content: AdaptedCvContent,
  name: string,
  email: string,
): CvData {
  return {
    name,
    email,
    headline: content.headline,
    phone: content.phone,
    location: content.location,
    website: content.website,
    linkedin: content.linkedin,
    summary: content.summary,
    experiences: content.experiences.map((item) => ({
      company: item.company,
      position: item.position,
      location: item.location,
      startDate: toDate(item.startDate),
      endDate: toDate(item.endDate),
      current: item.current,
      description: item.description,
      metrics: item.metrics,
    })),
    // El nivel no se renderiza en el documento (SPEC 09); se guarda 0 solo por
    // satisfacer el tipo CvSkill.
    skills: content.skills.map((item) => ({ name: item.name, level: 0 })),
    education: content.education.map((item) => ({
      degree: item.degree,
      institution: item.institution,
      field: item.field,
      startDate: toDate(item.startDate),
      endDate: toDate(item.endDate),
      current: item.current,
      description: item.description,
    })),
    certifications: content.certifications.map((item) => ({
      name: item.name,
      issuer: item.issuer,
      year: item.year,
    })),
    projects: content.projects.map((item) => ({
      name: item.name,
      role: item.role,
      description: item.description,
      techStack: item.techStack,
      metrics: item.metrics,
    })),
    languages: content.languages.map((item) => ({
      name: item.name,
      level: item.level,
    })),
  };
}

// Orquesta la generación de un CV adaptado: resuelve la oferta (y el match si
// viene), aplica las reglas deterministas, llama al parser de IA para la prosa,
// valida los originalId y persiste la versión con snapshots auditables.
@Injectable()
export class CvAdaptationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: CvAdaptationParserService,
    private readonly cvExport: CvExportService,
  ) {}

  async createForOffer(
    userId: string,
    jobOfferId: string,
    jobMatchId?: string,
    targetLang: UiLang = 'es',
  ): Promise<AdaptedCvDto> {
    const offer = await this.prisma.jobOffer.findFirst({
      where: { id: jobOfferId, userId },
    });
    if (!offer) {
      throw new NotFoundException('Oferta no encontrada.');
    }

    const profile = await this.profileForUser(userId);
    const localizedProfile = localizeProfile(profile, targetLang);
    const richSnapshot = adaptedProfileSnapshot(localizedProfile);
    const fingerprint = profileFingerprint(profileSnapshot(profile));

    const draft = this.toDraft(offer);
    const { content: baseContent, matchedSkillNames } = buildBaseContent(
      localizedProfile,
      offer,
    );

    const matchMissingSkills = await this.missingSkillsFromMatch(
      userId,
      jobMatchId,
    );
    const missingSkills = this.offerMissingSkills(
      draft.requiredSkills,
      draft.preferredSkills,
      profile,
      matchMissingSkills,
    );

    const input: AdaptationInput = {
      profile: richSnapshot,
      offer: {
        title: draft.title,
        company: draft.company,
        requiredSkills: draft.requiredSkills,
        preferredSkills: draft.preferredSkills,
        keywords: draft.keywords,
        experienceSummary: draft.experienceSummary,
      },
      matchedSkills: matchedSkillNames,
      missingSkills,
      sourceLanguage: targetLang,
      summaryFacts: buildSummaryFacts({
        profile: richSnapshot,
        matchedSkills: matchedSkillNames,
        sourceLanguage: targetLang,
      }),
    };

    const result = await this.parser.adapt(input);
    const summary = result.summary ?? baseContent.summary;
    const content = applyRewrites({ ...baseContent, summary }, result);

    const created = await this.prisma.adaptedCv.create({
      data: {
        userId,
        jobOfferId,
        jobMatchId: jobMatchId ?? null,
        sourceLanguage: targetLang,
        content: content as unknown as Prisma.InputJsonValue,
        offerSnapshot: draft as unknown as Prisma.InputJsonValue,
        profileSnapshot: richSnapshot as unknown as Prisma.InputJsonValue,
        profileFingerprint: fingerprint,
      },
    });
    return this.toDto(created, false);
  }

  async list(userId: string): Promise<AdaptedCvDto[]> {
    const currentFingerprint = await this.currentFingerprint(userId);
    const versions = await this.prisma.adaptedCv.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return versions.map((version) =>
      this.toDto(version, version.profileFingerprint !== currentFingerprint),
    );
  }

  async getById(userId: string, id: string): Promise<AdaptedCvDto> {
    const version = await this.findOwned(userId, id);
    const currentFingerprint = await this.currentFingerprint(userId);
    return this.toDto(
      version,
      version.profileFingerprint !== currentFingerprint,
    );
  }

  async exportCv(
    userId: string,
    id: string,
    format: 'pdf' | 'docx',
    lang?: 'es' | 'en',
  ): Promise<{ buffer: Buffer; candidateName: string }> {
    const version = await this.findOwned(userId, id);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }
    const content = version.content as unknown as AdaptedCvContent;
    const data = contentToCvData(content, user.name, user.email);
    const resolvedLang = lang ?? this.headingsLanguage(version.sourceLanguage);
    const buffer =
      format === 'pdf'
        ? await this.cvExport.buildPdf(data, resolvedLang)
        : await this.cvExport.buildDocx(data, resolvedLang);
    return { buffer, candidateName: user.name };
  }

  async remove(userId: string, id: string): Promise<void> {
    const version = await this.findOwned(userId, id);
    await this.prisma.adaptedCv.delete({ where: { id: version.id } });
  }

  // Títulos de sección: acompañan al contenido adaptado. Si la oferta estaba en
  // inglés se usan títulos en inglés; cualquier otro idioma o ausencia → español.
  private headingsLanguage(sourceLanguage: string | null): 'es' | 'en' {
    const lower = sourceLanguage?.toLowerCase() ?? '';
    if (lower.startsWith('en')) {
      return 'en';
    }
    return 'es';
  }

  private async missingSkillsFromMatch(
    userId: string,
    jobMatchId?: string,
  ): Promise<string[]> {
    if (!jobMatchId) {
      return [];
    }
    const match = await this.prisma.jobMatch.findFirst({
      where: { id: jobMatchId, userId },
    });
    if (!match) {
      throw new NotFoundException('Match no encontrado.');
    }
    return (match.gaps as unknown as JobMatchGap[])
      .filter((gap) => gap.status === 'MISSING')
      .map((gap) => gap.name);
  }

  // Skills que la oferta declara y el perfil NO tiene. Determinista y basada en
  // la oferta (nunca se inventan). Se unen a los gap MISSING del match (sin
  // duplicar por casing) para alimentar la línea de compromiso del resumen y la
  // guardia de la IA. Un skill de la oferta no es missing si el perfil lo
  // declara, incluso por contención ("React avanzado" contiene "react"); se
  // conserva el casing original de la oferta y se descartan frases completas
  // (token-clean).
  private offerMissingSkills(
    required: string[],
    preferred: string[],
    profile: ProfileWithCollections,
    matchMissing: string[],
  ): string[] {
    const profileNames = profile.skills
      .map((skill) => skill.name.trim().toLowerCase())
      .filter((name) => name.length >= 3);
    const merged = new Map<string, string>();
    for (const skill of [...required, ...preferred, ...matchMissing]) {
      const trimmed = skill?.trim() ?? '';
      const key = trimmed.toLowerCase();
      if (
        key.length === 0 ||
        this.profileHasSkill(profileNames, key) ||
        merged.has(key)
      ) {
        continue;
      }
      merged.set(key, trimmed);
    }
    return cleanStringArray([...merged.values()]);
  }

  private profileHasSkill(profileNames: string[], token: string): boolean {
    return profileNames.some(
      (name) => token.includes(name) || name.includes(token),
    );
  }

  private async profileForUser(
    userId: string,
  ): Promise<ProfileWithCollections> {
    const existing = await this.prisma.profile.findUnique({
      where: { userId },
      include: profileInclude,
    });
    if (existing) {
      return existing;
    }
    return emptyProfile();
  }

  private async currentFingerprint(userId: string): Promise<string> {
    const profile = await this.profileForUser(userId);
    return profileFingerprint(profileSnapshot(profile));
  }

  private async findOwned(userId: string, id: string): Promise<AdaptedCv> {
    const version = await this.prisma.adaptedCv.findFirst({
      where: { id, userId },
    });
    if (!version) {
      throw new NotFoundException('CV adaptado no encontrado.');
    }
    return version;
  }

  private toDraft(offer: {
    title: string;
    company: string | null;
    level: JobLevel | null;
    responsibilities: string[];
    requiredSkills: string[];
    preferredSkills: string[];
    experienceYears: number | null;
    experienceSummary: string | null;
    education: string[];
    languages: string[];
    keywords: string[];
  }): JobOfferDraft {
    return {
      title: offer.title ?? null,
      company: offer.company ?? null,
      level: offer.level ?? null,
      responsibilities: offer.responsibilities ?? [],
      requiredSkills: offer.requiredSkills ?? [],
      preferredSkills: offer.preferredSkills ?? [],
      experienceYears: offer.experienceYears ?? null,
      experienceSummary: offer.experienceSummary ?? null,
      education: offer.education ?? [],
      languages: offer.languages ?? [],
      keywords: offer.keywords ?? [],
    };
  }

  private toDto(version: AdaptedCv, stale: boolean): AdaptedCvDto {
    return {
      id: version.id,
      jobOfferId: version.jobOfferId,
      jobMatchId: version.jobMatchId,
      sourceLanguage: version.sourceLanguage,
      content: version.content,
      stale,
      createdAt: version.createdAt.toISOString(),
      updatedAt: version.updatedAt.toISOString(),
    };
  }
}
