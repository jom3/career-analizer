import {
  FORBIDDEN_EXPERTISE_TERMS,
  HIGH_SKILL_MIN,
  LOW_SKILL_MAX,
  qualifierForLevel,
} from './skill-level';

describe('skill-level', () => {
  it('define el rango de nivel bajo (1–3) y alto (4–5)', () => {
    expect(LOW_SKILL_MAX).toBe(3);
    expect(HIGH_SKILL_MIN).toBe(4);
  });

  it('devuelve el calificativo de cada nivel bajo en español', () => {
    expect(qualifierForLevel(1, 'es')).toBe('familiaridad con');
    expect(qualifierForLevel(2, 'es')).toBe('conocimientos básicos de');
    expect(qualifierForLevel(3, 'es')).toBe('conocimientos intermedios de');
  });

  it('devuelve el calificativo de cada nivel bajo en inglés', () => {
    expect(qualifierForLevel(1, 'en')).toBe('familiarity with');
    expect(qualifierForLevel(2, 'en')).toBe('basic knowledge of');
    expect(qualifierForLevel(3, 'en')).toBe('intermediate knowledge of');
  });

  it('devuelve null para niveles altos (4–5)', () => {
    expect(qualifierForLevel(4, 'es')).toBeNull();
    expect(qualifierForLevel(5, 'en')).toBeNull();
  });

  it('incluye términos de dominio/expertise en español e inglés', () => {
    expect(FORBIDDEN_EXPERTISE_TERMS).toContain('expert');
    expect(FORBIDDEN_EXPERTISE_TERMS).toContain('mastery');
    expect(FORBIDDEN_EXPERTISE_TERMS).toContain('advanced');
    expect(FORBIDDEN_EXPERTISE_TERMS).toContain('deep');
    expect(FORBIDDEN_EXPERTISE_TERMS).toContain('senior');
    expect(FORBIDDEN_EXPERTISE_TERMS).toContain('dominio de');
    expect(FORBIDDEN_EXPERTISE_TERMS).toContain('especialista en');
    expect(FORBIDDEN_EXPERTISE_TERMS).toContain('amplia experiencia en');
  });
});
