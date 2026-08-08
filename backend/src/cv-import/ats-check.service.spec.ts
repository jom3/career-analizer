import {
  AtsCheckService,
  MIN_SKILLS,
  MIN_SUMMARY_LENGTH,
} from './ats-check.service';
import { CvDraft } from './cv-import.types';
import { Source } from '../generated/prisma/enums.js';

describe('AtsCheckService', () => {
  let service: AtsCheckService;

  function emptyDraft(): CvDraft {
    return {
      headline: null,
      phone: null,
      location: null,
      website: null,
      linkedin: null,
      summary: null,
      experiences: [],
      skills: [],
      education: [],
      certifications: [],
      projects: [],
      languages: [],
    };
  }

  beforeEach(() => {
    service = new AtsCheckService();
  });

  it('devuelve los 7 chequeos en orden', () => {
    const report = service.check(emptyDraft());
    expect(report.map((item) => item.key)).toEqual([
      'contact',
      'headline',
      'summary',
      'experience',
      'skills',
      'education',
      'languages',
    ]);
  });

  it('marca como ok un borrador completo', () => {
    const draft = emptyDraft();
    draft.phone = '+549110000';
    draft.headline = 'Software Engineer';
    draft.summary = 'x'.repeat(MIN_SUMMARY_LENGTH);
    draft.experiences = [
      {
        company: 'Acme',
        position: 'Senior Developer',
        location: null,
        startDate: '2020-01-01',
        endDate: null,
        current: true,
        description: null,
        source: Source.CV_IMPORT,
        sortOrder: 0,
      },
    ];
    draft.skills = Array.from({ length: MIN_SKILLS }, (_, index) => ({
      name: `Skill ${index}`,
      level: 3,
      source: Source.CV_IMPORT,
      sortOrder: index,
    }));
    draft.education = [
      {
        degree: 'Lic.',
        institution: 'UNLP',
        field: null,
        startDate: null,
        endDate: null,
        current: false,
        description: null,
        source: Source.CV_IMPORT,
        sortOrder: 0,
      },
    ];
    draft.languages = [
      { name: 'Spanish', level: 'C2', source: Source.CV_IMPORT, sortOrder: 0 },
    ];

    const report = service.check(draft);
    expect(report.every((item) => item.ok)).toBe(true);
  });

  it('marca contact como ok con teléfono o ubicación', () => {
    const draft = emptyDraft();
    draft.location = 'Buenos Aires';
    const report = service.check(draft);
    expect(report.find((item) => item.key === 'contact')!.ok).toBe(true);
  });

  it('marca summary como ok solo con al menos 80 caracteres', () => {
    const short = service.check(emptyDraft());
    expect(short.find((item) => item.key === 'summary')!.ok).toBe(false);

    const draft = emptyDraft();
    draft.summary = 'a'.repeat(MIN_SUMMARY_LENGTH - 1);
    expect(
      service.check(draft).find((item) => item.key === 'summary')!.ok,
    ).toBe(false);

    draft.summary = 'a'.repeat(MIN_SUMMARY_LENGTH);
    expect(
      service.check(draft).find((item) => item.key === 'summary')!.ok,
    ).toBe(true);
  });

  it('marca experience como ok solo con empresa, cargo y al menos una fecha', () => {
    const draft = emptyDraft();
    draft.experiences = [
      {
        company: 'Acme',
        position: 'Developer',
        location: null,
        startDate: null,
        endDate: null,
        current: true,
        description: null,
        source: Source.CV_IMPORT,
        sortOrder: 0,
      },
    ];
    expect(
      service.check(draft).find((item) => item.key === 'experience')!.ok,
    ).toBe(false);

    draft.experiences[0].startDate = '2019-03-01';
    expect(
      service.check(draft).find((item) => item.key === 'experience')!.ok,
    ).toBe(true);
  });
});
