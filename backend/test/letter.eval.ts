import 'dotenv/config';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import OpenAI from 'openai';
import { validateLetter } from '../src/cover-letter/letter-validators';
import {
  COVER_LETTER_PROMPT_VERSION,
  buildCoverLetterSystemPrompt,
} from '../src/cover-letter/prompts/cover-letter.prompt';
import type { ProfileSnapshot } from '../src/job-match/profile-util';

// Banco manual de redacción de cartas. Compara la versión actual del prompt
// contra la anterior sobre los mismos datos: `npm run test:letter-eval`.
// No corre en CI.

const fixturesDir = join(__dirname, 'fixtures', 'evals');
const outputDir = join(__dirname, 'letter-eval-out');

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

const profiles: ProfileFixture[] = JSON.parse(
  readFileSync(join(fixturesDir, 'profiles.json'), 'utf8'),
) as ProfileFixture[];
const offers: OfferFixture[] = JSON.parse(
  readFileSync(join(fixturesDir, 'offers.json'), 'utf8'),
) as OfferFixture[];

// Retrato del prompt v2, para comparar sin depender del archivo actual.
const PROMPT_V2 = [
  'You are a senior career writer.',
  'Write a natural, human-sounding cover letter for this specific job.',
  'Use only facts from the candidate profile snapshot: never invent companies, positions, skills, metrics, numbers, education, certifications or projects.',
  'Describe past employers by their sector, never by name. Never claim a skill the profile lacks.',
  'One new fact per sentence. Never add a sentence or clause that explains, summarizes or justifies a fact already stated.',
  'No generic enthusiasm. No self-evaluation.',
  'No vague adjectives (efficient, key, relevant, solid, robust, advanced). If you cannot back one with a figure already in the profile, remove it; never add numbers.',
  'No forced connections to the job.',
  'Close with a concrete next step only: interview or call availability.',
  'Maximum 180 words. Body only, from greeting to closing line: date, subject and signature are added elsewhere.',
  'Use the recruiter name when provided; otherwise a localized generic greeting.',
  'Write in Spanish.',
].join(' ');

const cases = [
  { profile: 'P1', offer: 'O1' },
  { profile: 'P1', offer: 'O4' },
  { profile: 'P3', offer: 'O4' },
  { profile: 'P3', offer: 'O1' },
  { profile: 'P4', offer: 'O1' },
  { profile: 'P4', offer: 'O4' },
];

function profileOf(id: string): ProfileSnapshot {
  const found = profiles.find((item) => item.id === id);
  if (!found) throw new Error(`Perfil inexistente: ${id}`);
  return found.snapshot;
}

function offerOf(id: string): OfferFixture {
  const found = offers.find((item) => item.id === id);
  if (!found) throw new Error(`Oferta inexistente: ${id}`);
  return found;
}

function supportedNumbers(
  profile: ProfileSnapshot,
  offer: OfferFixture,
): string[] {
  const source = JSON.stringify({ profile, offer });
  return [...source.matchAll(/\d+(?:[.,]\d+)?\s?%?/g)].map((match) => match[0]);
}

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Falta OPENAI_API_KEY.');
    process.exitCode = 1;
    return;
  }
  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  mkdirSync(outputDir, { recursive: true });

  const prompts: { label: string; system: string }[] = [
    { label: 'v2', system: PROMPT_V2 },
    {
      label: `v${COVER_LETTER_PROMPT_VERSION}`,
      system: buildCoverLetterSystemPrompt('es'),
    },
  ];

  for (const prompt of prompts) {
    for (const testCase of cases) {
      const profile = profileOf(testCase.profile);
      const offer = offerOf(testCase.offer);
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
          { role: 'system', content: prompt.system },
          { role: 'user', content: `Oferta:\n${JSON.stringify(offer)}` },
          { role: 'user', content: `Perfil:\n${JSON.stringify(profile)}` },
          { role: 'user', content: 'Recruiter name: Ana' },
        ],
      });
      const raw = completion.choices[0]?.message?.content ?? 'null';
      const content = (JSON.parse(raw) as { content?: string }).content ?? '';
      const warnings = validateLetter(content, {
        lang: 'es',
        employers: profile.experiences.map((item) => item.company),
        targetCompany: offer.company,
        supportedNumbers: supportedNumbers(profile, offer),
      });
      const name = `${prompt.label}-${testCase.profile}-${testCase.offer}.md`;
      writeFileSync(join(outputDir, name), content, 'utf8');
      console.log(
        `${name} palabras=${content.split(/\s+/).length} warnings=${warnings.map((item) => item.code).join(',') || 'ninguno'}`,
      );
    }
  }
  console.log(`Salidas en ${outputDir}`);
}

void main();
