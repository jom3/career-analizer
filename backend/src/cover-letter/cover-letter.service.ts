import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import type { CoverLetter } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  profileInclude,
  type ProfileWithCollections,
} from '../profile/profile.service';
import { profileFingerprint, profileSnapshot } from '../job-match/profile-util';
import type {
  LetterDocument,
  LetterLang,
} from './cover-letter-document.service';
import { CoverLetterDocumentService } from './cover-letter-document.service';
import {
  CoverLetterParserService,
  type CoverLetterGenerationInput,
  type CoverLetterMatchInsight,
} from './cover-letter-parser.service';
import type {
  CoverLetterDraftDto,
  CoverLetterDto,
} from './dto/cover-letter.dto';

interface CoverLetterOfferSnapshot {
  title: string;
  company: string | null;
  sourceLanguage: string | null;
  responsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  experienceSummary: string | null;
  keywords: string[];
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

function resolveLetterLanguage(sourceLanguage: string | null): LetterLang {
  const lower = sourceLanguage?.toLowerCase() ?? '';
  if (lower.startsWith('en')) {
    return 'en';
  }
  return 'es';
}

function formatDateLine(lang: LetterLang): string {
  const locale = lang === 'en' ? 'en-US' : 'es-AR';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(
    new Date(),
  );
}

// Orquesta la carta de motivación: generar borrador (sin persistir) o persistir
// la versión final editada, historial con stale por huella del perfil y
// exportación PDF/DOCX con fecha, asunto y firma deterministas.
@Injectable()
export class CoverLetterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: CoverLetterParserService,
    private readonly documentService: CoverLetterDocumentService,
  ) {}

  async buildDraft(
    userId: string,
    jobOfferId: string,
    recruiterName: string | null,
    note: string | null,
  ): Promise<CoverLetterDraftDto> {
    const { offer, profile, lang } = await this.loadContext(userId, jobOfferId);
    const input: CoverLetterGenerationInput = {
      profile: profileSnapshot(profile),
      offer: this.offerForParser(offer),
      recruiterName,
      note,
      lang,
      match: await this.latestMatchInsight(userId, jobOfferId),
    };
    const result = await this.parser.generate(input);
    return { content: result.content, sourceLanguage: lang };
  }

  async create(
    userId: string,
    jobOfferId: string,
    recruiterName: string | null,
    note: string | null,
    content: string,
  ): Promise<CoverLetterDto> {
    const { offer, profile, fingerprint, lang } = await this.loadContext(
      userId,
      jobOfferId,
    );
    const created = await this.prisma.coverLetter.create({
      data: {
        userId,
        jobOfferId,
        recruiterName: recruiterName ?? null,
        note: note ?? null,
        sourceLanguage: lang,
        content,
        offerSnapshot: this.toOfferSnapshot(
          offer,
        ) as unknown as Prisma.InputJsonValue,
        profileSnapshot: profileSnapshot(
          profile,
        ) as unknown as Prisma.InputJsonValue,
        profileFingerprint: fingerprint,
      },
    });
    return this.toDto(created, false);
  }

  async list(userId: string): Promise<CoverLetterDto[]> {
    const currentFingerprint = await this.currentFingerprint(userId);
    const letters = await this.prisma.coverLetter.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return letters.map((letter) =>
      this.toDto(letter, letter.profileFingerprint !== currentFingerprint),
    );
  }

  async getById(userId: string, id: string): Promise<CoverLetterDto> {
    const letter = await this.findOwned(userId, id);
    const currentFingerprint = await this.currentFingerprint(userId);
    return this.toDto(letter, letter.profileFingerprint !== currentFingerprint);
  }

  async exportLetter(
    userId: string,
    id: string,
    format: 'pdf' | 'docx',
    lang?: 'es' | 'en',
  ): Promise<{ buffer: Buffer; candidateName: string }> {
    const letter = await this.findOwned(userId, id);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }
    const resolvedLang = lang ?? resolveLetterLanguage(letter.sourceLanguage);
    const offer = letter.offerSnapshot as unknown as CoverLetterOfferSnapshot;
    const subjectParts = [`Re: ${offer.title ?? ''}`];
    if (offer.company) {
      subjectParts.push(offer.company);
    }
    const document: LetterDocument = {
      dateLine: formatDateLine(resolvedLang),
      subject: subjectParts.join(' — '),
      content: letter.content,
      signature: `${user.name} — ${user.email}`,
      lang: resolvedLang,
    };
    const buffer =
      format === 'pdf'
        ? await this.documentService.buildLetterPdf(document)
        : await this.documentService.buildLetterDocx(document);
    return { buffer, candidateName: user.name };
  }

  async remove(userId: string, id: string): Promise<void> {
    const letter = await this.findOwned(userId, id);
    await this.prisma.coverLetter.delete({ where: { id: letter.id } });
  }

  // ---- privados ----

  private async loadContext(
    userId: string,
    jobOfferId: string,
  ): Promise<{
    offer: {
      id: string;
      title: string;
      company: string | null;
      sourceLanguage: string | null;
      responsibilities: string[];
      requiredSkills: string[];
      preferredSkills: string[];
      experienceSummary: string | null;
      keywords: string[];
    };
    profile: ProfileWithCollections;
    fingerprint: string;
    lang: LetterLang;
  }> {
    const offer = await this.prisma.jobOffer.findFirst({
      where: { id: jobOfferId, userId },
    });
    if (!offer) {
      throw new NotFoundException('Oferta no encontrada.');
    }
    const profile = await this.profileForUser(userId);
    const lang = resolveLetterLanguage(offer.sourceLanguage);
    return {
      offer,
      profile,
      fingerprint: profileFingerprint(profileSnapshot(profile)),
      lang,
    };
  }

  private offerForParser(offer: {
    title: string;
    company: string | null;
    responsibilities: string[];
    requiredSkills: string[];
    preferredSkills: string[];
    experienceSummary: string | null;
    keywords: string[];
  }): CoverLetterGenerationInput['offer'] {
    return {
      title: offer.title ?? null,
      company: offer.company ?? null,
      responsibilities: offer.responsibilities ?? [],
      requiredSkills: offer.requiredSkills ?? [],
      preferredSkills: offer.preferredSkills ?? [],
      experienceSummary: offer.experienceSummary ?? null,
      keywords: offer.keywords ?? [],
    };
  }

  private toOfferSnapshot(offer: {
    title: string;
    company: string | null;
    sourceLanguage: string | null;
    responsibilities: string[];
    requiredSkills: string[];
    preferredSkills: string[];
    experienceSummary: string | null;
    keywords: string[];
  }): CoverLetterOfferSnapshot {
    return {
      title: offer.title,
      company: offer.company,
      sourceLanguage: offer.sourceLanguage,
      responsibilities: offer.responsibilities ?? [],
      requiredSkills: offer.requiredSkills ?? [],
      preferredSkills: offer.preferredSkills ?? [],
      experienceSummary: offer.experienceSummary ?? null,
      keywords: offer.keywords ?? [],
    };
  }

  private async profileForUser(
    userId: string,
  ): Promise<ProfileWithCollections> {
    const existing = await this.prisma.profile.findUnique({
      where: { userId },
      include: profileInclude,
    });
    return existing ?? emptyProfile();
  }

  private async latestMatchInsight(
    userId: string,
    jobOfferId: string,
  ): Promise<CoverLetterMatchInsight | null> {
    const match = await this.prisma.jobMatch.findFirst({
      where: { userId, jobOfferId },
      orderBy: { createdAt: 'desc' },
      select: {
        overallScore: true,
        overallJustification: true,
        dimensions: true,
        gaps: true,
      },
    });
    if (!match) {
      return null;
    }
    const dimensions = (match.dimensions ??
      []) as CoverLetterMatchInsight['dimensions'];
    const gaps = (match.gaps ?? []) as CoverLetterMatchInsight['gaps'];
    return {
      overallScore: match.overallScore,
      overallJustification: match.overallJustification,
      dimensions,
      gaps: gaps.map(({ name, status }) => ({ name, status })),
    };
  }

  private async currentFingerprint(userId: string): Promise<string> {
    const profile = await this.profileForUser(userId);
    return profileFingerprint(profileSnapshot(profile));
  }

  private async findOwned(userId: string, id: string): Promise<CoverLetter> {
    const letter = await this.prisma.coverLetter.findFirst({
      where: { id, userId },
    });
    if (!letter) {
      throw new NotFoundException('Carta de motivación no encontrada.');
    }
    return letter;
  }

  private toDto(letter: CoverLetter, stale: boolean): CoverLetterDto {
    return {
      id: letter.id,
      jobOfferId: letter.jobOfferId,
      recruiterName: letter.recruiterName,
      note: letter.note,
      sourceLanguage: letter.sourceLanguage,
      content: letter.content,
      stale,
      createdAt: letter.createdAt.toISOString(),
      updatedAt: letter.updatedAt.toISOString(),
    };
  }
}
