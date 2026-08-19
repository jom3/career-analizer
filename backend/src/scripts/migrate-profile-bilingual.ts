import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { detectLanguage } from '../profile/bilingual.util.js';

// Devuelve la pareja de columnas por idioma para un campo dado.
function bilingualColumns(field: string): { es: string; en: string } {
  return { es: `${field}Es`, en: `${field}En` };
}

type Patch = Record<string, unknown>;

interface Row {
  id: string;
  [key: string]: unknown;
}

function patchBilingualField(patch: Patch, row: Row, field: string): void {
  const value = row[field];
  if (typeof value !== 'string' || value.trim().length === 0) return;
  const lang = detectLanguage(value);
  const { es, en } = bilingualColumns(field);
  patch[lang === 'es' ? es : en] = value;
}

function patchBilingualStringArray(
  patch: Patch,
  row: Row,
  field: string,
): void {
  const value = row[field];
  if (!Array.isArray(value)) return;
  const strings = value.filter(
    (item): item is string =>
      typeof item === 'string' && item.trim().length > 0,
  );
  if (strings.length === 0) return;
  const lang = detectLanguage(strings.join(' '));
  const { es, en } = bilingualColumns(field);
  patch[lang === 'es' ? es : en] = strings;
}

async function migrateProfile(prisma: PrismaClient): Promise<void> {
  const profiles = await prisma.profile.findMany({
    select: {
      id: true,
      headline: true,
      location: true,
      summary: true,
    },
  });
  for (const profile of profiles) {
    const patch: Patch = {};
    patchBilingualField(patch, profile, 'headline');
    patchBilingualField(patch, profile, 'location');
    patchBilingualField(patch, profile, 'summary');
    if (Object.keys(patch).length > 0) {
      await prisma.profile.update({ where: { id: profile.id }, data: patch });
    }
  }
}

async function migrateExperience(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.experience.findMany({
    select: {
      id: true,
      position: true,
      location: true,
      description: true,
      metrics: true,
    },
  });
  for (const row of rows) {
    const patch: Patch = {};
    patchBilingualField(patch, row, 'position');
    patchBilingualField(patch, row, 'location');
    patchBilingualField(patch, row, 'description');
    patchBilingualStringArray(patch, row, 'metrics');
    if (Object.keys(patch).length > 0) {
      await prisma.experience.update({ where: { id: row.id }, data: patch });
    }
  }
}

async function migrateEducation(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.education.findMany({
    select: {
      id: true,
      degree: true,
      institution: true,
      field: true,
      description: true,
    },
  });
  for (const row of rows) {
    const patch: Patch = {};
    patchBilingualField(patch, row, 'degree');
    patchBilingualField(patch, row, 'institution');
    patchBilingualField(patch, row, 'field');
    patchBilingualField(patch, row, 'description');
    if (Object.keys(patch).length > 0) {
      await prisma.education.update({ where: { id: row.id }, data: patch });
    }
  }
}

async function migrateCertification(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.certification.findMany({
    select: {
      id: true,
      name: true,
      issuer: true,
    },
  });
  for (const row of rows) {
    const patch: Patch = {};
    patchBilingualField(patch, row, 'name');
    patchBilingualField(patch, row, 'issuer');
    if (Object.keys(patch).length > 0) {
      await prisma.certification.update({ where: { id: row.id }, data: patch });
    }
  }
}

async function migrateProject(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      role: true,
      description: true,
      metrics: true,
    },
  });
  for (const row of rows) {
    const patch: Patch = {};
    patchBilingualField(patch, row, 'name');
    patchBilingualField(patch, row, 'role');
    patchBilingualField(patch, row, 'description');
    patchBilingualStringArray(patch, row, 'metrics');
    if (Object.keys(patch).length > 0) {
      await prisma.project.update({ where: { id: row.id }, data: patch });
    }
  }
}

async function migrateLanguage(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.language.findMany({
    select: {
      id: true,
      name: true,
    },
  });
  for (const row of rows) {
    const patch: Patch = {};
    patchBilingualField(patch, row, 'name');
    if (Object.keys(patch).length > 0) {
      await prisma.language.update({ where: { id: row.id }, data: patch });
    }
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    await migrateProfile(prisma);
    await migrateExperience(prisma);
    await migrateEducation(prisma);
    await migrateCertification(prisma);
    await migrateProject(prisma);
    await migrateLanguage(prisma);
    console.log('Migración bilingüe de perfiles completada.');
  } catch (error) {
    console.error('Error durante la migración bilingüe:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
