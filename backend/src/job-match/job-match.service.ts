import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { JobLevel, InputType } from '../generated/prisma/enums.js';
import type { JobMatch } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  profileInclude,
  type ProfileWithCollections,
} from '../profile/profile.service';
import type { JobOfferDraft } from '../job-analysis/job-analysis.types';
import type { JobOfferDto } from '../job-analysis/dto/job-offer.dto';
import { localizeProfile } from '../profile/localize-profile';
import type { JobMatchDto, JobMatchGap, MatchLang } from './dto/job-match.dto';
import {
  JobMatchParserService,
  type MatchAnalysis,
} from './job-match-parser.service';
import {
  type ProfileSnapshot,
  isWhitelistedSkill,
  offerSkillWhitelist,
  profileFingerprint,
  profileSnapshot,
} from './profile-util';

interface OfferSource {
  requiredSkills?: string[] | null;
  preferredSkills?: string[] | null;
  experienceSummary?: string | null;
}

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

// Orquesta el cálculo del encaje candidato↔oferta: resuelve la oferta (guardada
// o draft), carga el perfil del usuario, llama al parser de IA, aplica la
// whitelist de skills de la oferta a los gaps y persiste el JobMatch.
@Injectable()
export class JobMatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: JobMatchParserService,
  ) {}

  async createForOffer(
    userId: string,
    jobOfferId: string,
    lang: MatchLang,
  ): Promise<JobMatchDto> {
    const offer = await this.prisma.jobOffer.findFirst({
      where: { id: jobOfferId, userId },
    });
    if (!offer) {
      throw new NotFoundException('Oferta no encontrada.');
    }
    const draft = this.toDraft(offer);
    return this.computeAndPersist(userId, draft, offer, offer.id, lang);
  }

  async createForDraft(
    userId: string,
    offer: JobOfferDto,
    saveOffer: boolean,
    lang: MatchLang,
  ): Promise<JobMatchDto> {
    const draft = this.toDraft(offer);
    let jobOfferId: string | null = null;
    if (saveOffer) {
      const created = await this.prisma.jobOffer.create({
        data: {
          userId,
          title: draft.title ?? '',
          company: draft.company,
          level: draft.level,
          responsibilities: draft.responsibilities,
          requiredSkills: draft.requiredSkills,
          preferredSkills: draft.preferredSkills,
          experienceYears: draft.experienceYears,
          experienceSummary: draft.experienceSummary,
          education: draft.education,
          languages: draft.languages,
          keywords: draft.keywords,
          sourceLanguage: offer.sourceLanguage,
          inputType: offer.inputType ?? InputType.TEXT,
          rawInput: offer.rawInput,
        },
      });
      jobOfferId = created.id;
    }
    return this.computeAndPersist(userId, draft, draft, jobOfferId, lang);
  }

  async list(userId: string): Promise<JobMatchDto[]> {
    const currentFingerprint = await this.currentFingerprint(userId);
    const matches = await this.prisma.jobMatch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return matches.map((match) =>
      this.toDto(match, match.profileFingerprint !== currentFingerprint),
    );
  }

  async getById(userId: string, id: string): Promise<JobMatchDto> {
    const match = await this.findOwned(userId, id);
    const currentFingerprint = await this.currentFingerprint(userId);
    return this.toDto(match, match.profileFingerprint !== currentFingerprint);
  }

  async recompute(userId: string, id: string): Promise<JobMatchDto> {
    const match = await this.findOwned(userId, id);
    const draft = match.jobOfferId
      ? await this.draftFromOffer(match.jobOfferId)
      : (match.offerSnapshot as unknown as JobOfferDraft);
    const persisted = await this.computeAndPersist(
      userId,
      draft,
      draft,
      match.jobOfferId,
      match.lang as MatchLang,
      // Reemplaza el JobMatch existente: mismo id, sin crear una fila nueva.
      match.id,
    );
    return persisted;
  }

  async remove(userId: string, id: string): Promise<void> {
    const match = await this.findOwned(userId, id);
    await this.prisma.jobMatch.delete({ where: { id: match.id } });
  }

  private async computeAndPersist(
    userId: string,
    draft: JobOfferDraft,
    offerSource: OfferSource,
    jobOfferId: string | null,
    lang: MatchLang,
    existingId?: string,
  ): Promise<JobMatchDto> {
    const profile = await this.profileForUser(userId);
    const localized = localizeProfile(profile, lang);
    const snapshot = profileSnapshot(localized);
    const analysis = await this.matchWithWhitelist(
      draft,
      snapshot,
      offerSource,
      lang,
    );
    const fingerprint = profileFingerprint(profileSnapshot(profile));
    const shared = {
      jobOfferId,
      lang,
      overallScore: analysis.overallScore,
      overallJustification: analysis.overallJustification,
      dimensions: analysis.dimensions as unknown as Prisma.InputJsonValue,
      gaps: analysis.gaps as unknown as Prisma.InputJsonValue,
      recommendations:
        analysis.recommendations as unknown as Prisma.InputJsonValue,
      offerSnapshot: draft as unknown as Prisma.InputJsonValue,
      profileSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      profileFingerprint: fingerprint,
    };
    const match = existingId
      ? await this.prisma.jobMatch.update({
          where: { id: existingId },
          data: shared,
        })
      : await this.prisma.jobMatch.create({
          data: { ...shared, userId },
        });
    return this.toDto(match, false);
  }

  private async matchWithWhitelist(
    draft: JobOfferDraft,
    snapshot: ProfileSnapshot,
    offerSource: OfferSource,
    lang: MatchLang,
  ): Promise<MatchAnalysis> {
    const analysis = await this.parser.match(draft, snapshot, lang);
    const whitelist = offerSkillWhitelist({
      requiredSkills: offerSource.requiredSkills ?? [],
      preferredSkills: offerSource.preferredSkills ?? [],
      experienceSummary: offerSource.experienceSummary ?? null,
    });
    const gaps = analysis.gaps.filter((gap) =>
      isWhitelistedSkill(gap.name, whitelist),
    );
    if (gaps.length !== analysis.gaps.length) {
      console.warn(
        `Job match: ${analysis.gaps.length - gaps.length} gap(s) outside the offer whitelist dropped.`,
      );
    }
    return { ...analysis, gaps };
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

  private async findOwned(userId: string, id: string): Promise<JobMatch> {
    const match = await this.prisma.jobMatch.findFirst({
      where: { id, userId },
    });
    if (!match) {
      throw new NotFoundException('Match no encontrado.');
    }
    return match;
  }

  private async draftFromOffer(jobOfferId: string): Promise<JobOfferDraft> {
    const offer = await this.prisma.jobOffer.findUnique({
      where: { id: jobOfferId },
    });
    if (!offer) {
      throw new BadGatewayException('La oferta asociada ya no existe.');
    }
    return this.toDraft(offer);
  }

  private toDraft(
    offer:
      | JobOfferDto
      | {
          title: string;
          level: JobLevel | null;
          responsibilities: string[];
          requiredSkills: string[];
          preferredSkills: string[];
          experienceYears: number | null;
          experienceSummary: string | null;
          education: string[];
          languages: string[];
          keywords: string[];
        },
  ): JobOfferDraft {
    return {
      title: offer.title ?? null,
      company:
        'company' in offer && offer.company !== undefined
          ? (offer.company ?? null)
          : null,
      level: 'level' in offer ? (offer.level ?? null) : null,
      responsibilities: offer.responsibilities ?? [],
      requiredSkills: offer.requiredSkills ?? [],
      preferredSkills: offer.preferredSkills ?? [],
      experienceYears:
        'experienceYears' in offer ? (offer.experienceYears ?? null) : null,
      experienceSummary:
        'experienceSummary' in offer ? (offer.experienceSummary ?? null) : null,
      education: offer.education ?? [],
      languages: offer.languages ?? [],
      keywords: offer.keywords ?? [],
    };
  }

  private toDto(match: JobMatch, stale: boolean): JobMatchDto {
    return {
      id: match.id,
      jobOfferId: match.jobOfferId,
      lang: match.lang as MatchLang,
      overallScore: match.overallScore,
      overallJustification: match.overallJustification,
      dimensions: match.dimensions as unknown as JobMatchDto['dimensions'],
      gaps: match.gaps as unknown as JobMatchGap[],
      recommendations:
        match.recommendations as unknown as JobMatchDto['recommendations'],
      stale,
      createdAt: match.createdAt.toISOString(),
      updatedAt: match.updatedAt.toISOString(),
    };
  }
}
