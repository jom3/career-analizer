import type { UiLang } from '../i18n/ui-lang';

// Nivel "bajo" = 1–3 (SPEC 20): el CV adaptado nunca presenta un skill por
// encima del nivel declarado. Los niveles 4–5 se listan sin calificar.
export const LOW_SKILL_MAX = 3;
export const HIGH_SKILL_MIN = 4;

// Calificativo de la escala 1–3 en el idioma de generación. Se usa en el resumen
// determinista; null para niveles 4–5 (se listan sin calificar).
export function qualifierForLevel(level: number, lang: UiLang): string | null {
  switch (level) {
    case 1:
      return lang === 'es' ? 'familiaridad con' : 'familiarity with';
    case 2:
      return lang === 'es' ? 'conocimientos básicos de' : 'basic knowledge of';
    case 3:
      return lang === 'es'
        ? 'conocimientos intermedios de'
        : 'intermediate knowledge of';
    default:
      return null;
  }
}

// Términos de dominio/expertise que la IA no debe usar sobre skills de nivel
// bajo (1–3) al reescribir descripciones. Se inyectan en el prompt (SPEC 20).
export const FORBIDDEN_EXPERTISE_TERMS: readonly string[] = [
  'expert',
  'expertise',
  'master',
  'mastery',
  'advanced',
  'deep',
  'proficient',
  'specialist',
  'senior',
  'leading',
  'extensive experience',
  'dominio de',
  'dominio en',
  'experto en',
  'especialista en',
  'amplia experiencia en',
  'avanzado',
  'avanzada',
  'profundo',
  'profunda',
];
