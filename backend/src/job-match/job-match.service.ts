import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { JobLevel, InputType } from '../generated/prisma/enums.js';
import type { JobMatch } from '../generated/prisma/client';
import { apiError } from '../common/api-error-codes';
import {
  SCORING_VERSION,
  computeCoverage,
  reconcileGaps,
  weightedScore,
} from './coverage';
import {
  OFFER_CONTEXT_SELECT,
  toOfferContext,
  type OfferContextOffer,
} from '../common/offer-context';
import { PrismaService } from '../prisma/prisma.service';
import {
  profileInclude,
  type ProfileWithCollections,
} from '../profile/profile.service';
import type { JobOfferDraft } from '../job-analysis/job-analysis.types';
import type { JobOfferDto } from '../job-analysis/dto/job-offer.dto';
import { JobAnalysisService } from '../job-analysis/job-analysis.service';
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

type JobMatchRow = JobMatch & { jobOffer: OfferContextOffer | null };

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
    private readonly jobAnalysis: JobAnalysisService,
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
    return this.computeAndPersist(
      userId,
      draft,
      offer,
      offer.id,
      lang,
      undefined,
      { offer },
    );
  }

  async createForDraft(
    userId: string,
    offer: JobOfferDto,
    saveOffer: boolean,
    lang: MatchLang,
  ): Promise<JobMatchDto> {
    const draft = this.toDraft(offer);
    let jobOfferId: string | null = null;
    let savedOffer: OfferContextOffer | null = null;
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
          url: offer.url ?? null,
        },
      });
      jobOfferId = created.id;
      savedOffer = created;
    }
    return this.computeAndPersist(
      userId,
      draft,
      draft,
      jobOfferId,
      lang,
      undefined,
      { offer: savedOffer },
    );
  }

  async list(userId: string): Promise<JobMatchDto[]> {
    const currentFingerprint = await this.currentFingerprint(userId);
    const matches = await this.prisma.jobMatch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { jobOffer: { select: OFFER_CONTEXT_SELECT } },
    });
    return matches.map((match) =>
      this.toDto(
        match,
        match.profileFingerprint !== currentFingerprint,
        match.jobOffer,
      ),
    );
  }

  async getById(userId: string, id: string): Promise<JobMatchDto> {
    const match = await this.findOwned(userId, id);
    const currentFingerprint = await this.currentFingerprint(userId);
    return this.toDto(
      match,
      match.profileFingerprint !== currentFingerprint,
      match.jobOffer,
    );
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
      { offer: match.jobOffer },
    );
    return persisted;
  }

  // Guarda la oferta de un match calculado sin guardarla y la vincula.
  async saveOffer(userId: string, id: string): Promise<JobMatchDto> {
    const match = await this.findOwned(userId, id);
    if (match.jobOfferId) {
      throw new BadRequestException(
        apiError(
          'OFFER_ALREADY_SAVED',
          'El match ya tiene una oferta guardada.',
        ),
      );
    }
    const snapshot = match.offerSnapshot as unknown as JobOfferDraft;
    const created = await this.jobAnalysis.createFromDraft(userId, snapshot);
    const updated = await this.prisma.jobMatch.update({
      where: { id: match.id },
      data: { jobOfferId: created.id },
      include: { jobOffer: { select: OFFER_CONTEXT_SELECT } },
    });
    return this.toDto(updated, false, updated.jobOffer);
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
    context: { offer?: OfferContextOffer | null } = {},
  ): Promise<JobMatchDto> {
    const profile = await this.profileForUser(userId);
    const localized = localizeProfile(profile, lang);
    const snapshot = profileSnapshot(localized);
    const coverage = computeCoverage(draft.requiredSkills ?? [], snapshot);
    const analysis = await this.matchWithWhitelist(
      draft,
      snapshot,
      offerSource,
      lang,
      coverage.matched,
    );
    const fingerprint = profileFingerprint(profileSnapshot(profile));
    const shared = {
      jobOfferId,
      lang,
      overallScore: weightedScore(coverage, analysis.overallScore),
      aiScore: analysis.overallScore,
      coverage: coverage.percent,
      scoringVersion: SCORING_VERSION,
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
    return this.toDto(match, false, context.offer ?? null);
  }

  private async matchWithWhitelist(
    draft: JobOfferDraft,
    snapshot: ProfileSnapshot,
    offerSource: OfferSource,
    lang: MatchLang,
    matchedSkills: string[],
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
    return { ...analysis, gaps: reconcileGaps(gaps, matchedSkills, lang) };
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

  private async findOwned(userId: string, id: string): Promise<JobMatchRow> {
    const match = await this.prisma.jobMatch.findFirst({
      where: { id, userId },
      include: { jobOffer: { select: OFFER_CONTEXT_SELECT } },
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

  // Reconstruye el detalle de la cobertura desde los snapshots guardados. Los
  // matches anteriores a la versión 2 no tienen cobertura: solo score de IA.
  private coverageFor(match: JobMatch): JobMatchDto['coverage'] {
    if (match.scoringVersion < SCORING_VERSION || match.coverage === null) {
      return null;
    }
    const offer = (match.offerSnapshot ?? {}) as {
      requiredSkills?: string[];
    };
    const rawProfile = (match.profileSnapshot ??
      {}) as Partial<ProfileSnapshot>;
    const profile: ProfileSnapshot = {
      skills: rawProfile.skills ?? [],
      experiences: rawProfile.experiences ?? [],
      education: rawProfile.education ?? [],
      certifications: rawProfile.certifications ?? [],
      projects: rawProfile.projects ?? [],
      languages: rawProfile.languages ?? [],
    };
    const computed = computeCoverage(offer.requiredSkills ?? [], profile);
    return {
      matched: computed.matched,
      total: computed.total,
      percent: match.coverage,
    };
  }

  private toDto(
    match: JobMatch,
    stale: boolean,
    offer: OfferContextOffer | null = null,
  ): JobMatchDto {
    return {
      id: match.id,
      jobOfferId: match.jobOfferId,
      offer: toOfferContext({
        jobOfferId: match.jobOfferId,
        offer,
        snapshot: match.offerSnapshot as unknown as {
          title?: string | null;
          company?: string | null;
        },
      }),
      lang: match.lang as MatchLang,
      overallScore: match.overallScore,
      aiScore: match.aiScore,
      coverage: this.coverageFor(match),
      scoringVersion: match.scoringVersion,
      needsRecalculation: match.scoringVersion < SCORING_VERSION,
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
