import { describe, expect, it } from 'vitest';
import {
  completenessPercent,
  missingProfileSections,
} from './dashboard-completeness';

const emptyProfile = {
  headline: null,
  summary: null,
  experiences: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
  languages: [],
};

describe('completitud del perfil', () => {
  it('un perfil vacío cuenta todas las secciones como pendientes', () => {
    const missing = missingProfileSections(emptyProfile);

    expect(missing).toHaveLength(6);
    expect(completenessPercent(missing)).toBe(0);
  });

  it('solo skills no alcanza para el 100%', () => {
    const profile = { ...emptyProfile, skills: [{ name: 'TypeScript' }] };
    const missing = missingProfileSections(profile);

    expect(completenessPercent(missing)).toBeLessThan(100);
    expect(missing).toContain('dashboard.sectionExperience');
    expect(missing).not.toContain('dashboard.sectionSkills');
  });

  it('proyectos o certificaciones cubren la misma sección', () => {
    const withProject = missingProfileSections({
      ...emptyProfile,
      projects: [{}],
    });
    const withCertification = missingProfileSections({
      ...emptyProfile,
      certifications: [{}],
    });

    expect(withProject).not.toContain('dashboard.sectionProjects');
    expect(withCertification).not.toContain('dashboard.sectionProjects');
  });

  it('titular o resumen cubren la sección de introducción', () => {
    expect(
      missingProfileSections({ ...emptyProfile, headline: 'Backend Dev' }),
    ).not.toContain('dashboard.sectionIntro');
    expect(
      missingProfileSections({ ...emptyProfile, summary: 'Resumen' }),
    ).not.toContain('dashboard.sectionIntro');
  });

  it('un perfil completo marca 100%', () => {
    const missing = missingProfileSections({
      headline: 'Backend Dev',
      summary: null,
      experiences: [{}],
      education: [{}],
      skills: [{}],
      projects: [],
      certifications: [{}],
      languages: [{}],
    });

    expect(missing).toEqual([]);
    expect(completenessPercent(missing)).toBe(100);
  });
});
