import type { ProfileSnapshot } from '../job-match/profile-util';
import { hasEnoughEvidence } from './profile-sufficiency';

const empty: ProfileSnapshot = {
  skills: [],
  experiences: [],
  education: [],
  certifications: [],
  projects: [],
  languages: [],
};

describe('hasEnoughEvidence', () => {
  it('rechaza un perfil sin skills', () => {
    expect(
      hasEnoughEvidence({
        ...empty,
        experiences: [
          {
            position: 'Dev',
            company: 'X',
            description: 'Hice APIs',
            metrics: [],
          },
        ],
      }),
    ).toBe(false);
  });

  it('rechaza un perfil con skills pero sin experiencia descrita ni proyectos', () => {
    expect(
      hasEnoughEvidence({
        ...empty,
        skills: [{ name: 'JavaScript', level: 2 }],
      }),
    ).toBe(false);
  });

  it('acepta skills con una experiencia descrita', () => {
    expect(
      hasEnoughEvidence({
        ...empty,
        skills: [{ name: 'NestJS', level: 4 }],
        experiences: [
          {
            position: 'Dev',
            company: 'X',
            description: 'Hice APIs',
            metrics: [],
          },
        ],
      }),
    ).toBe(true);
  });

  it('acepta skills con un proyecto aunque no haya experiencia', () => {
    expect(
      hasEnoughEvidence({
        ...empty,
        skills: [{ name: 'NestJS', level: 4 }],
        projects: [{ name: 'Tablero', techStack: [], description: null }],
      }),
    ).toBe(true);
  });
});
