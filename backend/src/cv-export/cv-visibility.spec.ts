import type { CvData } from './cv-export.service';
import {
  applyCompactVisibility,
  applyDocumentedVisibility,
} from './cv-visibility';

const baseData: CvData = {
  name: 'Ana',
  email: 'ana@example.com',
  experiences: [],
  skills: [],
  education: [
    {
      degree: 'Licenciatura',
      institution: 'Universidad',
      current: false,
      showInCompactCv: true,
      showInDocumentedCv: true,
    },
    {
      degree: 'Diplomado',
      institution: 'Instituto',
      current: false,
      showInCompactCv: false,
      showInDocumentedCv: true,
    },
  ],
  certifications: [
    { name: 'Curso corto', showInCompactCv: false, showInDocumentedCv: false },
    { name: 'Curso largo', showInCompactCv: true, showInDocumentedCv: true },
    { name: 'Sin flags' },
  ],
  projects: [],
  languages: [],
};

describe('cv visibility', () => {
  it('compact view keeps items with showInCompactCv enabled or unset', () => {
    const result = applyCompactVisibility(baseData);

    expect(result.education.map((item) => item.degree)).toEqual([
      'Licenciatura',
    ]);
    expect(result.certifications.map((item) => item.name)).toEqual([
      'Curso largo',
      'Sin flags',
    ]);
  });

  it('documented view keeps items with showInDocumentedCv enabled or unset', () => {
    const result = applyDocumentedVisibility(baseData);

    expect(result.education.map((item) => item.degree)).toEqual([
      'Licenciatura',
      'Diplomado',
    ]);
    expect(result.certifications.map((item) => item.name)).toEqual([
      'Curso largo',
      'Sin flags',
    ]);
  });
});
