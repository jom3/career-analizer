import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { computeCoverage } from '../src/job-match/coverage';
import { JobMatchParserService } from '../src/job-match/job-match-parser.service';
import type { ProfileSnapshot } from '../src/job-match/profile-util';
import { OpenaiService } from '../src/openai/openai.service';
import type { JobOfferDraft } from '../src/job-analysis/job-analysis.types';

// Evaluación manual del scoring contra OpenAI real. No corre en CI:
// `npm run test:eval -w career-analyzer-backend`.

interface ProfileFixture {
  id: string;
  snapshot: ProfileSnapshot;
}

interface OfferFixture {
  id: string;
  title: string;
  company: string | null;
  level: JobOfferDraft['level'];
  requiredSkills: string[];
  preferredSkills: string[];
  experienceYears: number | null;
  experienceSummary: string | null;
  sourceLanguage: string;
}

interface CaseFixture {
  id: string;
  profile: string;
  offer: string;
  expect: {
    requiredMatched: string[];
    coverage: number;
    aiScoreRange: [number, number];
  };
}

const fixturesDir = join(__dirname, 'fixtures', 'evals');

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf8')) as T;
}

const profiles = readJson<ProfileFixture[]>('profiles.json');
const offers = readJson<OfferFixture[]>('offers.json');
const cases = readJson<CaseFixture[]>('cases.json');

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

function toDraft(offer: OfferFixture): JobOfferDraft {
  return {
    title: offer.title,
    company: offer.company,
    level: offer.level,
    responsibilities: [],
    requiredSkills: offer.requiredSkills,
    preferredSkills: offer.preferredSkills,
    experienceYears: offer.experienceYears,
    experienceSummary: offer.experienceSummary,
    education: [],
    languages: [],
    keywords: [],
  };
}

async function main(): Promise<void> {
  const config = new ConfigService({ ...process.env });
  const parser = new JobMatchParserService(config, new OpenaiService(config));

  let inRange = 0;
  const failures: string[] = [];
  const results: Array<{ coverage: number | null; aiScore: number }> = [];

  for (const testCase of cases) {
    const offer = offerOf(testCase.offer);
    const profile = profileOf(testCase.profile);
    const coverage = computeCoverage(offer.requiredSkills, profile);
    const analysis = await parser.match(toDraft(offer), profile, 'es');
    results.push({
      coverage: coverage.percent,
      aiScore: analysis.overallScore,
    });
    const [min, max] = testCase.expect.aiScoreRange;
    const coverageOk = coverage.percent === testCase.expect.coverage;
    const scoreOk =
      analysis.overallScore >= min && analysis.overallScore <= max;
    if (coverageOk && scoreOk) inRange++;
    if (!coverageOk || !scoreOk) {
      failures.push(
        `${testCase.id}: cobertura ${coverage.percent} (esperado ${testCase.expect.coverage}), ia ${analysis.overallScore} (rango ${min}-${max})`,
      );
    }
    console.log(
      `${testCase.id} cobertura=${coverage.percent} ia=${analysis.overallScore} ${coverageOk && scoreOk ? 'OK' : 'FUERA'}`,
    );
  }

  // Verificación de orden: la cobertura debe mandar sobre la banda del score,
  // sin depender de valores exactos del modelo.
  const fullCoverage = results.filter((item) => item.coverage === 100);
  const zeroCoverage = results.filter((item) => item.coverage === 0);
  if (fullCoverage.length > 0 && zeroCoverage.length > 0) {
    const lowestFull = Math.min(...fullCoverage.map((item) => item.aiScore));
    const highestZero = Math.max(...zeroCoverage.map((item) => item.aiScore));
    console.log(
      `Orden: cobertura 100 ≥ ${lowestFull} vs cobertura 0 ≤ ${highestZero}`,
    );
    if (lowestFull <= highestZero) {
      failures.push(
        `orden invertido: cobertura 100 dio ${lowestFull}, cobertura 0 dio ${highestZero}`,
      );
    }
  }

  const stabilityCase = cases[0];
  const stabilityScores: number[] = [];
  for (let run = 0; run < 3; run++) {
    const offer = offerOf(stabilityCase.offer);
    const analysis = await parser.match(
      toDraft(offer),
      profileOf(stabilityCase.profile),
      'es',
    );
    stabilityScores.push(analysis.overallScore);
  }
  const spread = Math.max(...stabilityScores) - Math.min(...stabilityScores);
  console.log(`Estabilidad ${stabilityCase.id}: ${stabilityScores.join(', ')}`);
  if (failures.length > 0) {
    console.error(`Fuera de rango:\n${failures.join('\n')}`);
  }

  // Umbral acordado: 8 de 10 casos en rango y estabilidad de ±3 puntos.
  if (inRange < 8 || spread > 3) {
    console.error(
      `Evaluación fallida: ${inRange}/${cases.length} en rango, dispersión ${spread}.`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    `Evaluación OK: ${inRange}/${cases.length}, dispersión ${spread}.`,
  );
}

void main();
