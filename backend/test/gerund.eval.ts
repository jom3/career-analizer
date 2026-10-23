import 'dotenv/config';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import OpenAI from 'openai';
import { CoverLetterParserService } from '../src/cover-letter/cover-letter-parser.service';
import { mentionsToken } from '../src/common/token-mention';
import { hasEnoughEvidence } from '../src/cover-letter/profile-sufficiency';
import { findSpanishGerunds } from '../src/cover-letter/spanish-gerunds';
import {
  CvAdaptationParserService,
  type AdaptationInput,
} from '../src/cv-adaptation/cv-adaptation-parser.service';
import type { AdaptedProfileSnapshot } from '../src/cv-adaptation/cv-adaptation.types';
import type { ProfileSnapshot } from '../src/job-match/profile-util';
import type { OpenaiService } from '../src/openai/openai.service';

// Medición de gerundios en descripciones de CV y en cartas (pipeline completo:
// borrador, validación y corrección): `npm run test:gerund-eval`.
// No corre en CI: consume tokens de OpenAI.

const fixturesDir = join(__dirname, 'fixtures', 'evals');
const outputDir = join(__dirname, 'gerund-eval-out');
const label = process.env.EVAL_LABEL ?? 'run';
const cvReps = Number(process.env.EVAL_REPS ?? 3);
const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
const judgeModel = process.env.EVAL_JUDGE_MODEL ?? 'gpt-4o';

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

function ownedSkills(snapshot: ProfileSnapshot): Set<string> {
  return new Set(snapshot.skills.map((skill) => skill.name.toLowerCase()));
}

function matchedSkills(
  snapshot: ProfileSnapshot,
  offer: OfferFixture,
): string[] {
  const owned = ownedSkills(snapshot);
  return offer.requiredSkills.filter((skill) => owned.has(skill.toLowerCase()));
}

function missingSkills(
  snapshot: ProfileSnapshot,
  offer: OfferFixture,
): string[] {
  const owned = ownedSkills(snapshot);
  return offer.requiredSkills.filter(
    (skill) => !owned.has(skill.toLowerCase()),
  );
}

interface Sample {
  kind: 'cv' | 'letter';
  name: string;
  text: string;
  gerunds: string[];
  unsupported: string[];
  missingSkills: string[];
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

async function generateLetter(
  parser: CoverLetterParserService,
  snapshot: ProfileSnapshot,
  offer: OfferFixture,
): Promise<string> {
  const result = await parser.generate({
    profile: snapshot,
    offer: {
      title: offer.title,
      company: offer.company,
      responsibilities: [],
      requiredSkills: offer.requiredSkills,
      preferredSkills: offer.preferredSkills,
      experienceSummary: offer.experienceSummary,
      keywords: [],
    },
    recruiterName: 'Ana',
    note: null,
    lang: 'es',
    match: null,
  });
  return result.content;
}

async function unsupportedClaims(
  client: OpenAI,
  letter: string,
  profile: ProfileSnapshot,
  offer: OfferFixture,
): Promise<string[]> {
  const completion = await client.chat.completions.create({
    model: judgeModel,
    temperature: 0,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'claims',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            unsupported: { type: 'array', items: { type: 'string' } },
          },
          required: ['unsupported'],
        },
      },
    },
    messages: [
      {
        role: 'system',
        content:
          'You audit a cover letter against two sources: the candidate profile and the job offer. List only the factual claims about the candidate (technology, role, company, metric, achievement, education, years, sector, skill level) that the two sources do NOT state. A claim supported by either source is not an issue. Do not list the sources themselves. Return an empty list when nothing is unsupported.',
      },
      { role: 'user', content: `Offer:\n${JSON.stringify(offer)}` },
      { role: 'user', content: `Profile:\n${JSON.stringify(profile)}` },
      { role: 'user', content: `Letter:\n${letter}` },
    ],
  });
  const raw = completion.choices[0]?.message?.content ?? '{"unsupported":[]}';
  return (JSON.parse(raw) as { unsupported: string[] }).unsupported;
}

function missingSkillMentions(
  letter: string,
  profile: ProfileSnapshot,
  offer: OfferFixture,
): string[] {
  const profileText = JSON.stringify(profile);
  return [...offer.requiredSkills, ...offer.preferredSkills].filter(
    (skill) =>
      !mentionsToken(profileText, skill) && mentionsToken(letter, skill),
  );
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
  const config = {
    get: (key: string, fallback?: string) =>
      key === 'OPENAI_MODEL' ? model : fallback,
  } as never;
  const openai = { client } as unknown as OpenaiService;
  const cvParser = new CvAdaptationParserService(config, openai);
  const letterParser = new CoverLetterParserService(config, openai);
  mkdirSync(outputDir, { recursive: true });

  const samples: Sample[] = [];
  const blockedLetters: string[] = [];
  for (const testCase of cases) {
    const profile = findOrThrow(profiles, testCase.profile).snapshot;
    const offer = findOrThrow(offers, testCase.offer);
    const base = `${testCase.profile}-${testCase.offer}`;

    for (let rep = 1; rep <= cvReps; rep++) {
      try {
        const text = await generateCvDescriptions(cvParser, profile, offer);
        const name = `${label}-cv-${base}-${rep}.md`;
        writeFileSync(join(outputDir, name), text, 'utf8');
        samples.push({
          kind: 'cv',
          name,
          text,
          gerunds: findSpanishGerunds(text),
          unsupported: [],
          missingSkills: [],
        });
      } catch (error) {
        console.error(`CV ${base} rep ${rep} falló:`, (error as Error).message);
      }
    }

    if (!hasEnoughEvidence(profile)) {
      blockedLetters.push(base);
      continue;
    }
    const letter = await generateLetter(letterParser, profile, offer);
    const letterName = `${label}-letter-${base}.md`;
    writeFileSync(join(outputDir, letterName), letter, 'utf8');
    const claims = await unsupportedClaims(client, letter, profile, offer);
    const skillMentions = missingSkillMentions(letter, profile, offer);
    samples.push({
      kind: 'letter',
      name: letterName,
      text: letter,
      gerunds: findSpanishGerunds(letter),
      unsupported: claims,
      missingSkills: skillMentions,
    });
  }

  const letters = samples.filter((sample) => sample.kind === 'letter');
  const summary = {
    label,
    model,
    cv: summarize(samples.filter((sample) => sample.kind === 'cv')),
    letter: {
      ...summarize(letters),
      blockedByProfile: blockedLetters,
      withUnsupportedClaims: letters.filter((s) => s.unsupported.length > 0)
        .length,
      unsupportedClaims: letters.flatMap((s) => s.unsupported).slice(0, 15),
      withMissingSkillMentions: letters.filter(
        (s) => s.missingSkills.length > 0,
      ).length,
    },
  };
  writeFileSync(
    join(outputDir, `${label}-summary.json`),
    JSON.stringify(summary, null, 2),
    'utf8',
  );
  console.log(JSON.stringify(summary, null, 2));
}

void main();
