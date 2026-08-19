import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { Source } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileDto } from './dto/profile.dto';
import {
  resolveBilingualString,
  resolveBilingualStringArray,
} from './bilingual.util';
import {
  ProfileTranslatorService,
  type Lang,
  type ProfileTranslationResult,
} from './profile-translator.service';

export const profileInclude = {
  experiences: { orderBy: { sortOrder: 'asc' as const } },
  skills: { orderBy: { sortOrder: 'asc' as const } },
  education: { orderBy: { sortOrder: 'asc' as const } },
  certifications: { orderBy: { sortOrder: 'asc' as const } },
  projects: { orderBy: { sortOrder: 'asc' as const } },
  languages: { orderBy: { sortOrder: 'asc' as const } },
} satisfies Prisma.ProfileInclude;

export type ProfileWithCollections = Prisma.ProfileGetPayload<{
  include: typeof profileInclude;
}>;

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly translator: ProfileTranslatorService,
  ) {}

  async getForUser(userId: string): Promise<ProfileWithCollections> {
    const existing = await this.prisma.profile.findUnique({
      where: { userId },
      include: profileInclude,
    });
    if (existing) {
      return existing;
    }
    const created = await this.prisma.profile.create({
      data: { userId },
      include: profileInclude,
    });
    return created;
  }

  // Traduce el perfil al idioma destino y devuelve el resultado como borrador
  // (NO persiste). El idioma de origen es el que viene en fromLang si se provee;
  // si no, el que tiene contenido (si ambos tienen, el de mayor cobertura,
  // empate → es).
  async translateForUser(
    userId: string,
    targetLang: Lang,
    fromLang?: Lang,
  ): Promise<ProfileWithCollections> {
    const profile = await this.getForUser(userId);
    const sourceLang = fromLang ?? this.resolveSourceLang(profile);
    if (sourceLang === targetLang) {
      return profile;
    }
    const result = await this.translator.translate({
      profile,
      sourceLang,
      targetLang,
    });
    return this.applyTranslation(profile, result, targetLang);
  }

  private resolveSourceLang(profile: ProfileWithCollections): Lang {
    let esCount = 0;
    let enCount = 0;
    const count = (value: unknown, fieldEs: boolean): void => {
      if (Array.isArray(value) ? value.length > 0 : Boolean(value)) {
        if (fieldEs) esCount++;
        else enCount++;
      }
    };

    for (const field of ['headline', 'location', 'summary']) {
      count(profile[field + 'Es'], true);
      count(profile[field + 'En'], false);
    }
    for (const item of profile.experiences) {
      for (const field of ['position', 'location', 'description']) {
        count(item[field + 'Es'], true);
        count(item[field + 'En'], false);
      }
      count(item.metricsEs, true);
      count(item.metricsEn, false);
    }
    for (const item of profile.education) {
      for (const field of ['degree', 'institution', 'field', 'description']) {
        count(item[field + 'Es'], true);
        count(item[field + 'En'], false);
      }
    }
    for (const item of profile.certifications) {
      count(item.nameEs, true);
      count(item.nameEn, false);
      count(item.issuerEs, true);
      count(item.issuerEn, false);
    }
    for (const item of profile.projects) {
      for (const field of ['name', 'role', 'description']) {
        count(item[field + 'Es'], true);
        count(item[field + 'En'], false);
      }
      count(item.metricsEs, true);
      count(item.metricsEn, false);
    }
    for (const item of profile.languages) {
      count(item.nameEs, true);
      count(item.nameEn, false);
    }

    return enCount > esCount ? 'en' : 'es';
  }

  private applyTranslation(
    profile: ProfileWithCollections,
    result: ProfileTranslationResult,
    targetLang: Lang,
  ): ProfileWithCollections {
    const suffix = targetLang === 'es' ? 'Es' : 'En';
    const setField = (
      target: Record<string, unknown>,
      field: string,
      value: unknown,
    ): void => {
      target[field + suffix] = value;
    };

    const translated = {
      ...profile,
      headlineEs: profile.headlineEs,
      headlineEn: profile.headlineEn,
      locationEs: profile.locationEs,
      locationEn: profile.locationEn,
      summaryEs: profile.summaryEs,
      summaryEn: profile.summaryEn,
    } as Record<string, unknown>;
    setField(translated, 'headline', result.profile.headline);
    setField(translated, 'location', result.profile.location);
    setField(translated, 'summary', result.profile.summary);

    const byId = <T extends { id: string }>(list: T[]) =>
      new Map(list.map((item) => [item.id, item]));

    const expMap = byId(result.experiences);
    const eduMap = byId(result.education);
    const certMap = byId(result.certifications);
    const projMap = byId(result.projects);
    const langMap = byId(result.languages);

    translated.experiences = profile.experiences.map((item) => {
      const t = expMap.get(item.id);
      if (!t) return item;
      const out = { ...item } as Record<string, unknown>;
      setField(out, 'position', t.position);
      setField(out, 'location', t.location);
      setField(out, 'description', t.description);
      setField(out, 'metrics', t.metrics ?? []);
      return out as typeof item;
    });
    translated.education = profile.education.map((item) => {
      const t = eduMap.get(item.id);
      if (!t) return item;
      const out = { ...item } as Record<string, unknown>;
      setField(out, 'degree', t.degree);
      setField(out, 'institution', t.institution);
      setField(out, 'field', t.field);
      setField(out, 'description', t.description);
      return out as typeof item;
    });
    translated.certifications = profile.certifications.map((item) => {
      const t = certMap.get(item.id);
      if (!t) return item;
      const out = { ...item } as Record<string, unknown>;
      setField(out, 'name', t.name);
      setField(out, 'issuer', t.issuer);
      return out as typeof item;
    });
    translated.projects = profile.projects.map((item) => {
      const t = projMap.get(item.id);
      if (!t) return item;
      const out = { ...item } as Record<string, unknown>;
      setField(out, 'name', t.name);
      setField(out, 'role', t.role);
      setField(out, 'description', t.description);
      setField(out, 'metrics', t.metrics ?? []);
      return out as typeof item;
    });
    translated.languages = profile.languages.map((item) => {
      const t = langMap.get(item.id);
      if (!t) return item;
      const out = { ...item } as Record<string, unknown>;
      setField(out, 'name', t.name);
      return out as typeof item;
    });

    return translated as unknown as ProfileWithCollections;
  }

  async replaceForUser(
    userId: string,
    dto: ProfileDto,
  ): Promise<ProfileWithCollections> {
    return this.prisma.$transaction(async (tx) => {
      const profile =
        (await tx.profile.findUnique({ where: { userId } })) ??
        (await tx.profile.create({ data: { userId } }));

      await tx.profile.update({
        where: { id: profile.id },
        data: {
          ...this.profileBilingualData(dto),
          phone: dto.phone ?? null,
          website: dto.website ?? null,
          linkedin: dto.linkedin ?? null,
          source: dto.source ?? Source.USER,
        },
        include: profileInclude,
      });

      await this.syncExperiences(tx, profile.id, dto.experiences);
      await this.syncSkills(tx, profile.id, dto.skills);
      await this.syncEducation(tx, profile.id, dto.education);
      await this.syncCertifications(tx, profile.id, dto.certifications);
      await this.syncProjects(tx, profile.id, dto.projects);
      await this.syncLanguages(tx, profile.id, dto.languages);

      return tx.profile.findUniqueOrThrow({
        where: { id: profile.id },
        include: profileInclude,
      });
    });
  }

  private toDate(value?: string): Date | null {
    return value ? new Date(value) : null;
  }

  private profileBilingualData(dto: ProfileDto): {
    headline: string | null;
    headlineEs: string | null;
    headlineEn: string | null;
    location: string | null;
    locationEs: string | null;
    locationEn: string | null;
    summary: string | null;
    summaryEs: string | null;
    summaryEn: string | null;
  } {
    const headline = resolveBilingualString(dto.headline, dto.headlineI18n);
    const location = resolveBilingualString(dto.location, dto.locationI18n);
    const summary = resolveBilingualString(dto.summary, dto.summaryI18n);
    return {
      headline: headline.flat,
      headlineEs: headline.es,
      headlineEn: headline.en,
      location: location.flat,
      locationEs: location.es,
      locationEn: location.en,
      summary: summary.flat,
      summaryEs: summary.es,
      summaryEn: summary.en,
    };
  }

  private async syncExperiences(
    tx: Prisma.TransactionClient,
    profileId: string,
    items: ProfileDto['experiences'],
  ): Promise<void> {
    const owned = await tx.experience.findMany({
      where: { profileId },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((row) => row.id));
    const keptIds = items
      .filter((item) => item.id && ownedIds.has(item.id))
      .map((item) => item.id!);

    await tx.experience.deleteMany({
      where: { profileId, id: { notIn: keptIds } },
    });

    for (const item of items) {
      const position = resolveBilingualString(item.position, item.positionI18n);
      const location = resolveBilingualString(item.location, item.locationI18n);
      const description = resolveBilingualString(
        item.description,
        item.descriptionI18n,
      );
      const metrics = resolveBilingualStringArray(
        item.metrics,
        item.metricsI18n,
      );
      const data = {
        company: item.company,
        position: position.flat ?? '',
        positionEs: position.es,
        positionEn: position.en,
        location: location.flat,
        locationEs: location.es,
        locationEn: location.en,
        startDate: this.toDate(item.startDate),
        endDate: item.current ? null : this.toDate(item.endDate),
        current: item.current,
        description: description.flat,
        descriptionEs: description.es,
        descriptionEn: description.en,
        metrics: metrics.flat,
        metricsEs: metrics.es,
        metricsEn: metrics.en,
        source: item.source ?? Source.USER,
        sortOrder: item.sortOrder,
      };
      if (item.id && ownedIds.has(item.id)) {
        await tx.experience.update({ where: { id: item.id }, data });
      } else {
        await tx.experience.create({ data: { ...data, profileId } });
      }
    }
  }

  private async syncSkills(
    tx: Prisma.TransactionClient,
    profileId: string,
    items: ProfileDto['skills'],
  ): Promise<void> {
    const owned = await tx.skill.findMany({
      where: { profileId },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((row) => row.id));
    const keptIds = items
      .filter((item) => item.id && ownedIds.has(item.id))
      .map((item) => item.id!);

    await tx.skill.deleteMany({ where: { profileId, id: { notIn: keptIds } } });

    for (const item of items) {
      const data = {
        name: item.name,
        level: item.level,
        source: item.source ?? Source.USER,
        sortOrder: item.sortOrder,
      };
      if (item.id && ownedIds.has(item.id)) {
        await tx.skill.update({ where: { id: item.id }, data });
      } else {
        await tx.skill.create({ data: { ...data, profileId } });
      }
    }
  }

  private async syncEducation(
    tx: Prisma.TransactionClient,
    profileId: string,
    items: ProfileDto['education'],
  ): Promise<void> {
    const owned = await tx.education.findMany({
      where: { profileId },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((row) => row.id));
    const keptIds = items
      .filter((item) => item.id && ownedIds.has(item.id))
      .map((item) => item.id!);

    await tx.education.deleteMany({
      where: { profileId, id: { notIn: keptIds } },
    });

    for (const item of items) {
      const degree = resolveBilingualString(item.degree, item.degreeI18n);
      const institution = resolveBilingualString(
        item.institution,
        item.institutionI18n,
      );
      const field = resolveBilingualString(item.field, item.fieldI18n);
      const description = resolveBilingualString(
        item.description,
        item.descriptionI18n,
      );
      const data = {
        degree: degree.flat ?? '',
        degreeEs: degree.es,
        degreeEn: degree.en,
        institution: institution.flat ?? '',
        institutionEs: institution.es,
        institutionEn: institution.en,
        field: field.flat,
        fieldEs: field.es,
        fieldEn: field.en,
        startDate: this.toDate(item.startDate),
        endDate: item.current ? null : this.toDate(item.endDate),
        current: item.current,
        description: description.flat,
        descriptionEs: description.es,
        descriptionEn: description.en,
        source: item.source ?? Source.USER,
        sortOrder: item.sortOrder,
      };
      if (item.id && ownedIds.has(item.id)) {
        await tx.education.update({ where: { id: item.id }, data });
      } else {
        await tx.education.create({ data: { ...data, profileId } });
      }
    }
  }

  private async syncCertifications(
    tx: Prisma.TransactionClient,
    profileId: string,
    items: ProfileDto['certifications'],
  ): Promise<void> {
    const owned = await tx.certification.findMany({
      where: { profileId },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((row) => row.id));
    const keptIds = items
      .filter((item) => item.id && ownedIds.has(item.id))
      .map((item) => item.id!);

    await tx.certification.deleteMany({
      where: { profileId, id: { notIn: keptIds } },
    });

    for (const item of items) {
      const name = resolveBilingualString(item.name, item.nameI18n);
      const issuer = resolveBilingualString(item.issuer, item.issuerI18n);
      const data = {
        name: name.flat ?? '',
        nameEs: name.es,
        nameEn: name.en,
        issuer: issuer.flat,
        issuerEs: issuer.es,
        issuerEn: issuer.en,
        year: item.year ?? null,
        url: item.url ?? null,
        source: item.source ?? Source.USER,
        sortOrder: item.sortOrder,
      };
      if (item.id && ownedIds.has(item.id)) {
        await tx.certification.update({ where: { id: item.id }, data });
      } else {
        await tx.certification.create({ data: { ...data, profileId } });
      }
    }
  }

  private async syncProjects(
    tx: Prisma.TransactionClient,
    profileId: string,
    items: ProfileDto['projects'],
  ): Promise<void> {
    const owned = await tx.project.findMany({
      where: { profileId },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((row) => row.id));
    const keptIds = items
      .filter((item) => item.id && ownedIds.has(item.id))
      .map((item) => item.id!);

    await tx.project.deleteMany({
      where: { profileId, id: { notIn: keptIds } },
    });

    for (const item of items) {
      const name = resolveBilingualString(item.name, item.nameI18n);
      const role = resolveBilingualString(item.role, item.roleI18n);
      const description = resolveBilingualString(
        item.description,
        item.descriptionI18n,
      );
      const metrics = resolveBilingualStringArray(
        item.metrics,
        item.metricsI18n,
      );
      const data = {
        name: name.flat ?? '',
        nameEs: name.es,
        nameEn: name.en,
        role: role.flat,
        roleEs: role.es,
        roleEn: role.en,
        description: description.flat,
        descriptionEs: description.es,
        descriptionEn: description.en,
        url: item.url ?? null,
        techStack: item.techStack,
        metrics: metrics.flat,
        metricsEs: metrics.es,
        metricsEn: metrics.en,
        source: item.source ?? Source.USER,
        sortOrder: item.sortOrder,
      };
      if (item.id && ownedIds.has(item.id)) {
        await tx.project.update({ where: { id: item.id }, data });
      } else {
        await tx.project.create({ data: { ...data, profileId } });
      }
    }
  }

  private async syncLanguages(
    tx: Prisma.TransactionClient,
    profileId: string,
    items: ProfileDto['languages'],
  ): Promise<void> {
    const owned = await tx.language.findMany({
      where: { profileId },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((row) => row.id));
    const keptIds = items
      .filter((item) => item.id && ownedIds.has(item.id))
      .map((item) => item.id!);

    await tx.language.deleteMany({
      where: { profileId, id: { notIn: keptIds } },
    });

    for (const item of items) {
      const name = resolveBilingualString(item.name, item.nameI18n);
      const data = {
        name: name.flat ?? '',
        nameEs: name.es,
        nameEn: name.en,
        level: item.level,
        source: item.source ?? Source.USER,
        sortOrder: item.sortOrder,
      };
      if (item.id && ownedIds.has(item.id)) {
        await tx.language.update({ where: { id: item.id }, data });
      } else {
        await tx.language.create({ data: { ...data, profileId } });
      }
    }
  }
}
