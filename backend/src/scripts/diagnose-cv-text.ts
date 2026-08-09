import 'dotenv/config';
import * as path from 'path';
import { readFile } from 'fs/promises';
import { PDFParse } from 'pdf-parse';
import * as mammoth from 'mammoth';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { MIME_TYPE_DOCX } from '../cv-import/text-extractor.service.js';
import { normalizeText } from '../cv-import/text-normalizer.js';

interface DraftStringField {
  field: string;
  value: string;
}

// Re-extrae el texto crudo del archivo (sin normalizar) usando los mismos
// extractores que el pipeline de importación.
async function extractRaw(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === MIME_TYPE_DOCX) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  const pdf = new PDFParse({ data: buffer });
  try {
    const result = await pdf.getText({ pageJoiner: '\n' });
    return result.text;
  } finally {
    await pdf.destroy();
  }
}

// Recolecta todos los campos de texto del draft con su etiqueta para el reporte.
function collectDraftStrings(
  draft: Record<string, unknown>,
): DraftStringField[] {
  const values: DraftStringField[] = [];
  const push = (field: string, value: unknown): void => {
    if (typeof value === 'string' && value.trim().length > 0) {
      values.push({ field, value: value.trim() });
    }
  };
  const pushArrayItem = (
    items: unknown,
    fields: { key: string; label: string }[],
  ): void => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (typeof item !== 'object' || item === null) continue;
      const record = item as Record<string, unknown>;
      for (const { key, label } of fields) {
        push(label, record[key]);
      }
    }
  };

  push('headline', draft.headline);
  push('phone', draft.phone);
  push('location', draft.location);
  push('website', draft.website);
  push('linkedin', draft.linkedin);
  push('summary', draft.summary);
  pushArrayItem(draft.experiences, [
    { key: 'company', label: 'experience.company' },
    { key: 'position', label: 'experience.position' },
    { key: 'location', label: 'experience.location' },
    { key: 'description', label: 'experience.description' },
  ]);
  pushArrayItem(draft.skills, [{ key: 'name', label: 'skill' }]);
  pushArrayItem(draft.education, [
    { key: 'degree', label: 'education.degree' },
    { key: 'institution', label: 'education.institution' },
    { key: 'field', label: 'education.field' },
    { key: 'description', label: 'education.description' },
  ]);
  pushArrayItem(draft.certifications, [
    { key: 'name', label: 'certification' },
    { key: 'issuer', label: 'certification.issuer' },
  ]);
  pushArrayItem(draft.projects, [
    { key: 'name', label: 'project' },
    { key: 'role', label: 'project.role' },
    { key: 'description', label: 'project.description' },
  ]);
  pushArrayItem(draft.languages, [
    { key: 'name', label: 'language' },
    { key: 'level', label: 'language.level' },
  ]);

  return values;
}

// Tokeniza el texto: minúsculas, sin acentos, solo palabras de 3+ caracteres.
function tokenize(text: string): Set<string> {
  const deaccented = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return new Set(deaccented.split(/[^a-z0-9]+/).filter((t) => t.length >= 3));
}

function parseDocumentId(argv: string[]): string | null {
  const arg = argv.find((item) => item.startsWith('--documentId='));
  return arg ? arg.split('=')[1] : null;
}

async function main(): Promise<void> {
  const documentId = parseDocumentId(process.argv.slice(2));
  if (!documentId) {
    console.error(
      'Uso: node dist/scripts/diagnose-cv-text.js --documentId=<id>',
    );
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const document = await prisma.cvDocument.findUnique({
      where: { id: documentId },
    });
    if (!document) {
      console.error(`No se encontró un CvDocument con id "${documentId}".`);
      process.exit(1);
    }

    console.log(`=== Diagnóstico del documento "${document.originalName}" ===`);
    console.log(`Id: ${document.id} | Modelo: ${document.model ?? 'n/d'}`);
    console.log(`Storage path: ${document.storagePath}`);
    console.log('');

    const rawBuffer = await readFile(
      path.resolve(process.cwd(), document.storagePath),
    );
    const rawText = await extractRaw(rawBuffer, document.mimeType);

    console.log('--- (a) Texto crudo (extracción sin normalizar) ---');
    console.log(rawText);
    console.log('');

    const normalizedText = normalizeText(rawText);
    console.log('--- (b) Texto normalizado (baseline de extractedText) ---');
    console.log(normalizedText);
    console.log('');

    const draft =
      typeof document.draftJson === 'object' && document.draftJson !== null
        ? (document.draftJson as Record<string, unknown>)
        : null;
    if (!draft) {
      console.log('--- (c) Tokens del draft ausentes ---');
      console.log('El documento no tiene draftJson; no hay nada que comparar.');
      return;
    }

    const normalizedTokens = tokenize(normalizedText);
    const missing = collectDraftStrings(draft)
      .map(({ field, value }) => ({
        field,
        value,
        tokens: tokenize(value),
      }))
      .filter((entry) =>
        [...entry.tokens].some((token) => !normalizedTokens.has(token)),
      )
      .map((entry) => ({
        field: entry.field,
        missing: [...entry.tokens].filter(
          (token) => !normalizedTokens.has(token),
        ),
      }));

    console.log(
      '--- (c) Tokens del draft ausentes en el texto normalizado ---',
    );
    if (missing.length === 0) {
      console.log('Ninguno: el draft es consistente con el texto extraído.');
    } else {
      for (const { field, missing: missingTokens } of missing) {
        console.log(`- ${field}: ${missingTokens.join(', ')}`);
      }
      console.log(
        'Estos tokens no aparecen en el texto del CV: señal de invención de la IA o error de parseo.',
      );
    }
  } catch (error) {
    console.error('Error durante el diagnóstico:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
