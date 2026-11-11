import type {
  CvData,
  CvEducation,
  CvExperience,
  CvLang,
  CvProject,
} from '../cv-export/cv-export.service';

export interface PhotoCvEntry {
  title: string;
  subtitle?: string;
  meta?: string;
  paragraphs: string[];
  bullets: string[];
}

export interface PhotoCvBar {
  label: string;
  ratio: number;
}

export interface PhotoCvCertification {
  name: string;
  issuer?: string;
}

export interface PhotoCvPersonalItem {
  label: string;
  value: string;
}

export interface PhotoCvTitles {
  profile: string;
  education: string;
  experience: string;
  certifications: string;
  achievements: string;
  personal: string;
  skills: string;
  languages: string;
}

export interface PhotoCvModel {
  name: string;
  headline?: string;
  contacts: string[];
  personal: PhotoCvPersonalItem[];
  summary: string[];
  experiences: PhotoCvEntry[];
  education: PhotoCvEntry[];
  certifications: PhotoCvCertification[];
  achievements: PhotoCvEntry[];
  skills: PhotoCvBar[];
  languages: PhotoCvBar[];
  titles: PhotoCvTitles;
}

const MAX_SKILL_LEVEL = 5;
const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const MONTHS: Record<CvLang, string[]> = {
  es: [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ],
  en: [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ],
};

const TITLES: Record<CvLang, PhotoCvTitles> = {
  es: {
    profile: 'Perfil',
    education: 'Formación',
    experience: 'Experiencia',
    certifications: 'Certificaciones',
    achievements: 'Logros',
    personal: 'Datos personales',
    skills: 'Habilidades',
    languages: 'Idiomas',
  },
  en: {
    profile: 'Profile',
    education: 'Education',
    experience: 'Experience',
    certifications: 'Certifications',
    achievements: 'Achievements',
    personal: 'Personal details',
    skills: 'Skills',
    languages: 'Languages',
  },
};

const LABELS: Record<CvLang, { website: string; present: string }> = {
  es: { website: 'Página web', present: 'Actualidad' },
  en: { website: 'Website', present: 'Present' },
};

export function buildPhotoCvModel(data: CvData, lang: CvLang): PhotoCvModel {
  const personal: PhotoCvPersonalItem[] = [];
  if (data.website) {
    personal.push({ label: LABELS[lang].website, value: data.website });
  }
  if (data.linkedin) {
    personal.push({ label: 'LinkedIn', value: data.linkedin });
  }

  return {
    name: data.name,
    headline: data.headline,
    contacts: [data.email, data.phone, data.location].filter(
      (part): part is string => Boolean(part),
    ),
    personal,
    summary: nonEmptyLines(data.summary),
    experiences: data.experiences.map((item) => experienceEntry(item, lang)),
    education: data.education.map((item) => educationEntry(item, lang)),
    certifications: data.certifications.map((item) => ({
      name: item.name,
      issuer: item.issuer,
    })),
    achievements: data.projects.map((item) => projectEntry(item)),
    skills: data.skills.map((item) => ({
      label: item.name,
      ratio: clampRatio(item.level / MAX_SKILL_LEVEL),
    })),
    languages: data.languages.map((item) => ({
      label: `${item.name} (${item.level})`,
      ratio: clampRatio(
        (CEFR_LEVELS.indexOf(item.level) + 1) / CEFR_LEVELS.length,
      ),
    })),
    titles: TITLES[lang],
  };
}

export function formatShortRange(
  start: Date | undefined,
  end: Date | undefined,
  current: boolean,
  lang: CvLang,
): string {
  if (!start && !end && !current) {
    return '';
  }
  const startLabel = start ? formatMonthYear(start, lang) : '—';
  const endLabel = current
    ? LABELS[lang].present
    : end
      ? formatMonthYear(end, lang)
      : '—';
  return `${startLabel} - ${endLabel}`;
}

function experienceEntry(item: CvExperience, lang: CvLang): PhotoCvEntry {
  return {
    title: item.position,
    subtitle: [item.company, item.location].filter(Boolean).join(' · '),
    meta: formatShortRange(item.startDate, item.endDate, item.current, lang),
    paragraphs: nonEmptyLines(item.description),
    bullets: item.metrics ?? [],
  };
}

function educationEntry(item: CvEducation, lang: CvLang): PhotoCvEntry {
  return {
    title: item.degree,
    subtitle: item.institution,
    meta: formatShortRange(item.startDate, item.endDate, item.current, lang),
    paragraphs: [
      ...(item.field ? [item.field] : []),
      ...nonEmptyLines(item.description),
    ],
    bullets: [],
  };
}

function projectEntry(item: CvProject): PhotoCvEntry {
  return {
    title: item.name,
    subtitle:
      [item.role, item.techStack.join(', ')].filter(Boolean).join(' · ') ||
      undefined,
    paragraphs: nonEmptyLines(item.description),
    bullets: item.metrics ?? [],
  };
}

function formatMonthYear(date: Date, lang: CvLang): string {
  return `${MONTHS[lang][date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function clampRatio(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function nonEmptyLines(text?: string): string[] {
  if (!text) {
    return [];
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
