import 'dotenv/config';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import OpenAI from 'openai';
import { buildCoverLetterSystemPrompt } from '../src/cover-letter/prompts/cover-letter.prompt';
import {
  CvAdaptationParserService,
  type AdaptationInput,
} from '../src/cv-adaptation/cv-adaptation-parser.service';
import type { AdaptedProfileSnapshot } from '../src/cv-adaptation/cv-adaptation.types';
import type { ProfileSnapshot } from '../src/job-match/profile-util';
import type { OpenaiService } from '../src/openai/openai.service';

// Medición de gerundios en descripciones de CV y cartas: `npm run test:gerund-eval`.
// No corre en CI: consume tokens de OpenAI.

const fixturesDir = join(__dirname, 'fixtures', 'evals');
const outputDir = join(__dirname, 'gerund-eval-out');
const label = process.env.EVAL_LABEL ?? 'run';
const cvReps = Number(process.env.EVAL_REPS ?? 3);
const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

const GERUND_SUFFIX =
  /(ando|iendo|yendo)(me|te|se|nos|os|le|les|lo|la|los|las)?$/;
const GERUND_EXCEPTIONS = new Set([
  'cuando',
  'mando',
  'comando',
  'demando',
  'fernando',
  'armando',
  'hernando',
  'rolando',
  'orlando',
]);

function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function findGerunds(text: string): string[] {
  const words = text.match(/\p{L}+/gu) ?? [];
  return words.filter((word) => {
    const normalized = normalizeWord(word);
    return !GERUND_EXCEPTIONS.has(normalized) && GERUND_SUFFIX.test(normalized);
  });
}

interface ProfileFixture {
  id: string;
  snapshot: ProfileSnapshot;
}

interface OfferFixture {
  id: string;
  title: string;
  company: string | null;
  requiredSkills: string[];
  preferredSkills: string[];
  experienceSummary: string | null;
}

const profiles = JSON.parse(
  readFileSync(join(fixturesDir, 'profiles.json'), 'utf8'),
) as ProfileFixture[];
const offers = JSON.parse(
  readFileSync(join(fixturesDir, 'offers.json'), 'utf8'),
) as OfferFixture[];

const cases = [
  { profile: 'P1', offer: 'O1' },
  { profile: 'P1', offer: 'O4' },
  { profile: 'P3', offer: 'O4' },
  { profile: 'P3', offer: 'O1' },
  { profile: 'P4', offer: 'O1' },
  { profile: 'P4', offer: 'O4' },
];

function findOrThrow<T extends { id: string }>(items: T[], id: string): T {
  const found = items.find((item) => item.id === id);
  if (!found) throw new Error(`Fixture inexistente: ${id}`);
  return found;
}

// El fixture no trae ids ni fechas: se completan para el shape de producción.
function toAdaptedSnapshot(snapshot: ProfileSnapshot): AdaptedProfileSnapshot {
  return {
    headline: null,
    ...snapshot,
    skills: snapshot.skills.map((skill, index) => ({
      id: `skill-${index}`,
      ...skill,
    })),
    experiences: snapshot.experiences.map((item, index) => ({
      id: `exp-${index}`,
      location: null,
      startDate: null,
      endDate: null,
      current: false,
      description: item.description ?? null,
      metrics: item.metrics ?? [],
      position: item.position,
      company: item.company,
    })),
    education: snapshot.education.map((item, index) => ({
      id: `edu-${index}`,
      startDate: null,
      endDate: null,
      current: false,
      description: null,
      field: item.field ?? null,
      degree: item.degree,
      institution: item.institution,
    })),
  } as unknown as AdaptedProfileSnapshot;
}

function matchedSkills(
  snapshot: ProfileSnapshot,
  offer: OfferFixture,
): string[] {
  const owned = new Set(
    snapshot.skills.map((skill) => skill.name.toLowerCase()),
  );
  return offer.requiredSkills.filter((skill) => owned.has(skill.toLowerCase()));
}

function missingSkills(
  snapshot: ProfileSnapshot,
  offer: OfferFixture,
): string[] {
  const owned = new Set(
    snapshot.skills.map((skill) => skill.name.toLowerCase()),
  );
  return offer.requiredSkills.filter(
    (skill) => !owned.has(skill.toLowerCase()),
  );
}

interface Sample {
  kind: 'cv' | 'letter';
  name: string;
  text: string;
  gerunds: string[];
}

async function generateLetter(
  client: OpenAI,
  snapshot: ProfileSnapshot,
  offer: OfferFixture,
): Promise<string> {
  const completion = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'cover_letter',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: { content: { type: 'string' } },
          required: ['content'],
        },
      },
    },
    messages: [
      { role: 'system', content: buildCoverLetterSystemPrompt('es') },
      { role: 'user', content: `Oferta:\n${JSON.stringify(offer)}` },
      { role: 'user', content: `Perfil:\n${JSON.stringify(snapshot)}` },
      { role: 'user', content: 'Recruiter name: Ana' },
    ],
  });
  const raw = completion.choices[0]?.message?.content ?? 'null';
  return (JSON.parse(raw) as { content?: string }).content ?? '';
}

async function generateCvDescriptions(
  parser: CvAdaptationParserService,
  snapshot: ProfileSnapshot,
  offer: OfferFixture,
): Promise<string> {
  const input: AdaptationInput = {
    profile: toAdaptedSnapshot(snapshot),
    offer: {
      title: offer.title,
      company: offer.company,
      requiredSkills: offer.requiredSkills,
      preferredSkills: offer.preferredSkills,
      keywords: [],
      experienceSummary: offer.experienceSummary,
    },
    matchedSkills: matchedSkills(snapshot, offer),
    missingSkills: missingSkills(snapshot, offer),
    documentLang: 'es',
  };
  const result = await parser.adapt(input);
  return result.experienceDescriptions.map((item) => item.text).join('\n');
}

function summarize(samples: Sample[]): object {
  const withGerunds = samples.filter((sample) => sample.gerunds.length > 0);
  return {
    samples: samples.length,
    withGerunds: withGerunds.length,
    totalGerunds: samples.reduce(
      (sum, sample) => sum + sample.gerunds.length,
      0,
    ),
    examples: withGerunds.flatMap((sample) => sample.gerunds).slice(0, 15),
  };
}

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Falta OPENAI_API_KEY.');
    process.exitCode = 1;
    return;
  }
  const client = new OpenAI({ apiKey });
  const parser = new CvAdaptationParserService(
    {
      get: (key: string, fallback?: string) =>
        key === 'OPENAI_MODEL' ? model : fallback,
    } as never,
    { client } as unknown as OpenaiService,
  );
  mkdirSync(outputDir, { recursive: true });

  const samples: Sample[] = [];
  for (const testCase of cases) {
    const profile = findOrThrow(profiles, testCase.profile).snapshot;
    const offer = findOrThrow(offers, testCase.offer);
    const base = `${testCase.profile}-${testCase.offer}`;

    for (let rep = 1; rep <= cvReps; rep++) {
      try {
        const text = await generateCvDescriptions(parser, profile, offer);
        const name = `${label}-cv-${base}-${rep}.md`;
        writeFileSync(join(outputDir, name), text, 'utf8');
        samples.push({ kind: 'cv', name, text, gerunds: findGerunds(text) });
      } catch (error) {
        console.error(`CV ${base} rep ${rep} falló:`, (error as Error).message);
      }
    }

    const letter = await generateLetter(client, profile, offer);
    const letterName = `${label}-letter-${base}.md`;
    writeFileSync(join(outputDir, letterName), letter, 'utf8');
    samples.push({
      kind: 'letter',
      name: letterName,
      text: letter,
      gerunds: findGerunds(letter),
    });
  }

  const summary = {
    label,
    model,
    cv: summarize(samples.filter((sample) => sample.kind === 'cv')),
    letter: summarize(samples.filter((sample) => sample.kind === 'letter')),
  };
  writeFileSync(
    join(outputDir, `${label}-summary.json`),
    JSON.stringify(summary, null, 2),
    'utf8',
  );
  console.log(JSON.stringify(summary, null, 2));
}

void main();
