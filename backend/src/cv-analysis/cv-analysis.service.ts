import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  profileInclude,
  type ProfileWithCollections,
} from '../profile/profile.service';
import { CvAnalysisParserService } from './cv-analysis-parser.service';
import {
  CV_CHECK_WEIGHTS,
  type CvAnalysis,
  type CvCheck,
  type CvCheckKey,
  type CvSuggestion,
} from './cv-analysis.types';

const MIN_SKILLS = 5;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function hasDuplicates(values: string[]): boolean {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) return true;
    seen.add(value);
  }
  return false;
}

// Diagnóstico determinista del CV: la nota no depende de la IA.
@Injectable()
export class CvAnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: CvAnalysisParserService,
  ) {}

  async analyze(userId: string, lang: 'es' | 'en'): Promise<CvAnalysis> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: profileInclude,
    });
    const checks = this.checksFor(profile);

    let strengths: string[] = [];
    let suggestions: CvSuggestion[] = [];
    let aiAvailable = false;
    // Sin contenido no hay nada que revisar: no se gasta una llamada a la IA.
    if (profile && this.hasContent(profile)) {
      try {
        const review = await this.parser.review(profile, lang);
        strengths = review.strengths;
        suggestions = review.suggestions;
        aiAvailable = true;
      } catch (error) {
        // La IA es un extra: sin ella la página sigue mostrando el diagnóstico.
        console.error('CV analysis AI review failed:', error);
      }
    }

    return {
      score: this.scoreFor(checks),
      checks,
      strengths,
      suggestions,
      lang,
      aiAvailable,
    };
  }

  private checksFor(profile: ProfileWithCollections | null): CvCheck[] {
    if (!profile) {
      return this.checksForEmpty();
    }
    const skillNames = profile.skills.map((skill) => normalize(skill.name));
    const experienceKeys = profile.experiences.map((experience) =>
      normalize(
        [
          experience.company,
          experience.position,
          this.dateKey(experience.startDate),
          this.dateKey(experience.endDate),
        ].join('|'),
      ),
    );

    return [
      this.check(
        'intro',
        Boolean(profile.headline?.trim() || profile.summary?.trim()),
      ),
      this.check(
        'contact',
        Boolean(profile.phone?.trim() || profile.location?.trim()),
      ),
      this.check(
        'experience',
        profile.experiences.some((item) => Boolean(item.description?.trim())),
      ),
      this.check(
        'experienceMetrics',
        profile.experiences.some((item) => item.metrics.length > 0),
      ),
      this.check('education', profile.education.length > 0),
      this.check(
        'skills',
        profile.skills.length >= MIN_SKILLS,
        String(profile.skills.length),
      ),
      this.check(
        'projects',
        profile.projects.length > 0 || profile.certifications.length > 0,
      ),
      this.check('languages', profile.languages.length > 0),
      // Sin contenido no hay nada que deduplicar: no suma puntos.
      this.check(
        'noDuplicates',
        (skillNames.length > 0 || experienceKeys.length > 0) &&
          !hasDuplicates(skillNames) &&
          !hasDuplicates(experienceKeys),
      ),
    ];
  }

  private hasContent(profile: ProfileWithCollections): boolean {
    return Boolean(
      profile.headline?.trim() ||
      profile.summary?.trim() ||
      profile.experiences.length > 0 ||
      profile.skills.length > 0 ||
      profile.education.length > 0 ||
      profile.certifications.length > 0 ||
      profile.projects.length > 0 ||
      profile.languages.length > 0,
    );
  }

  private checksForEmpty(): CvCheck[] {
    return (Object.keys(CV_CHECK_WEIGHTS) as CvCheckKey[]).map((key) => ({
      key,
      ok: false,
    }));
  }

  private check(key: CvCheckKey, ok: boolean, detail?: string): CvCheck {
    return detail === undefined ? { key, ok } : { key, ok, detail };
  }

  private scoreFor(checks: CvCheck[]): number {
    return checks.reduce(
      (total, check) =>
        check.ok ? total + CV_CHECK_WEIGHTS[check.key] : total,
      0,
    );
  }

  private dateKey(value: Date | null): string {
    return value ? value.toISOString().slice(0, 10) : '';
  }
}
