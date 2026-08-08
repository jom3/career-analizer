import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileDto } from './dto/profile.dto';

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
  constructor(private readonly prisma: PrismaService) {}

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
          headline: dto.headline ?? null,
          phone: dto.phone ?? null,
          location: dto.location ?? null,
          website: dto.website ?? null,
          linkedin: dto.linkedin ?? null,
          summary: dto.summary ?? null,
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
      const data = {
        company: item.company,
        position: item.position,
        location: item.location ?? null,
        startDate: this.toDate(item.startDate),
        endDate: item.current ? null : this.toDate(item.endDate),
        current: item.current,
        description: item.description ?? null,
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
      const data = {
        degree: item.degree,
        institution: item.institution,
        field: item.field ?? null,
        startDate: this.toDate(item.startDate),
        endDate: item.current ? null : this.toDate(item.endDate),
        current: item.current,
        description: item.description ?? null,
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
      const data = {
        name: item.name,
        issuer: item.issuer ?? null,
        year: item.year ?? null,
        url: item.url ?? null,
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
      const data = {
        name: item.name,
        role: item.role ?? null,
        description: item.description ?? null,
        url: item.url ?? null,
        techStack: item.techStack,
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
      const data = {
        name: item.name,
        level: item.level,
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
