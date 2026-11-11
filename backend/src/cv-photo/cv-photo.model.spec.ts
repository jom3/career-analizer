import type { CvData } from '../cv-export/cv-export.service';
import { buildPhotoCvModel, formatShortRange } from './cv-photo.model';

const data: CvData = {
  name: 'Ana Pérez',
  email: 'ana@example.com',
  phone: '+591 700',
  location: 'Tarija',
  headline: 'Desarrolladora',
  website: 'ana.dev',
  linkedin: 'linkedin.com/in/ana',
  summary: 'Primera línea\n\nSegunda línea',
  experiences: [
    {
      company: 'Acme',
      position: 'Dev',
      current: true,
      startDate: new Date('2025-01-01T00:00:00Z'),
      description: 'Diseñé APIs',
      metrics: ['Redujo tiempos 20%'],
    },
  ],
  skills: [{ name: 'TypeScript', level: 4 }],
  education: [
    {
      degree: 'Licenciatura',
      institution: 'Universidad',
      field: 'Informática',
      current: false,
      startDate: new Date('2014-01-01T00:00:00Z'),
      endDate: new Date('2022-01-01T00:00:00Z'),
    },
  ],
  certifications: [{ name: 'Curso', issuer: 'Udemy' }],
  projects: [],
  languages: [
    { name: 'Inglés', level: 'B2' },
    { name: 'Español', level: 'C2' },
  ],
};

describe('buildPhotoCvModel', () => {
  it('formats date ranges with short month names in Spanish', () => {
    const model = buildPhotoCvModel(data, 'es');

    expect(model.education[0].meta).toBe('ene 2014 - ene 2022');
    expect(model.experiences[0].meta).toBe('ene 2025 - Actualidad');
  });

  it('formats date ranges with short month names in English', () => {
    const model = buildPhotoCvModel(data, 'en');

    expect(model.education[0].meta).toBe('Jan 2014 - Jan 2022');
    expect(model.experiences[0].meta).toBe('Jan 2025 - Present');
  });

  it('maps skill levels over five and CEFR levels over six', () => {
    const model = buildPhotoCvModel(data, 'es');

    expect(model.skills).toEqual([{ label: 'TypeScript', ratio: 0.8 }]);
    expect(model.languages).toEqual([
      { label: 'Inglés (B2)', ratio: 4 / 6 },
      { label: 'Español (C2)', ratio: 1 },
    ]);
  });

  it('splits multiline text into non-empty paragraphs and keeps metrics as bullets', () => {
    const model = buildPhotoCvModel(data, 'es');

    expect(model.summary).toEqual(['Primera línea', 'Segunda línea']);
    expect(model.experiences[0].paragraphs).toEqual(['Diseñé APIs']);
    expect(model.experiences[0].bullets).toEqual(['Redujo tiempos 20%']);
  });

  it('lists personal details only when they are filled', () => {
    const model = buildPhotoCvModel(data, 'es');

    expect(model.personal).toEqual([
      { label: 'Página web', value: 'ana.dev' },
      { label: 'LinkedIn', value: 'linkedin.com/in/ana' },
    ]);
  });

  it('uses the titles of the requested language', () => {
    expect(buildPhotoCvModel(data, 'en').titles.skills).toBe('Skills');
    expect(buildPhotoCvModel(data, 'es').titles.skills).toBe('Habilidades');
  });
});

describe('formatShortRange', () => {
  it('returns an empty string when there are no dates', () => {
    expect(formatShortRange(undefined, undefined, false, 'es')).toBe('');
  });
});
