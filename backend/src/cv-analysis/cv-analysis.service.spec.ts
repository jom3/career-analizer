import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CvAnalysisParserService } from './cv-analysis-parser.service';
import { CvAnalysisService } from './cv-analysis.service';

function baseProfile() {
  return {
    id: 'profile-1',
    userId: 'user-1',
    headline: 'Backend Developer',
    phone: '+54 11 5555-5555',
    location: 'Buenos Aires',
    website: null,
    linkedin: null,
    summary: 'Backend con Node.js.',
    headlineEs: null,
    headlineEn: null,
    locationEs: null,
    locationEn: null,
    summaryEs: null,
    summaryEn: null,
    source: 'USER',
    experiences: [
      {
        id: 'exp-1',
        company: 'Acme',
        position: 'Backend Engineer',
        description: 'APIs con NestJS.',
        metrics: ['Latencia -30%'],
        startDate: new Date('2020-01-01'),
        endDate: null,
      },
    ],
    skills: [
      { name: 'Node.js' },
      { name: 'NestJS' },
      { name: 'PostgreSQL' },
      { name: 'TypeScript' },
      { name: 'Docker' },
    ],
    education: [{ degree: 'Ingeniería', institution: 'Universidad' }],
    certifications: [{ name: 'AWS' }],
    projects: [{ name: 'Tablero', techStack: ['Angular'] }],
    languages: [{ name: 'Inglés', level: 'B2' }],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('CvAnalysisService', () => {
  let service: CvAnalysisService;
  let prismaMock: { profile: { findUnique: jest.Mock } };
  let parserMock: { review: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock = { profile: { findUnique: jest.fn() } };
    parserMock = {
      review: jest.fn().mockResolvedValue({
        strengths: ['Usa NestJS y PostgreSQL en producción.'],
        suggestions: [
          { section: 'experience', action: 'Sumá métricas a tu experiencia.' },
        ],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CvAnalysisService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: CvAnalysisParserService, useValue: parserMock },
      ],
    }).compile();

    service = module.get(CvAnalysisService);
  });

  it('devuelve nota 0 y sin IA cuando no hay perfil', async () => {
    prismaMock.profile.findUnique.mockResolvedValue(null);

    const result = await service.analyze('user-1', 'es');

    expect(result.score).toBe(0);
    expect(result.checks).toHaveLength(9);
    expect(result.checks.every((check) => !check.ok)).toBe(true);
    expect(result.aiAvailable).toBe(false);
    expect(result.strengths).toEqual([]);
    expect(parserMock.review).not.toHaveBeenCalled();
  });

  it('da 100 con un perfil completo', async () => {
    prismaMock.profile.findUnique.mockResolvedValue(baseProfile());

    const result = await service.analyze('user-1', 'es');

    expect(result.score).toBe(100);
    expect(result.checks.every((check) => check.ok)).toBe(true);
    expect(result.aiAvailable).toBe(true);
    expect(result.strengths).toHaveLength(1);
    expect(result.suggestions).toHaveLength(1);
  });

  it('no llama a la IA cuando el perfil existe pero está vacío', async () => {
    const empty = {
      ...baseProfile(),
      headline: null,
      phone: null,
      location: null,
      summary: null,
      experiences: [],
      skills: [],
      education: [],
      certifications: [],
      projects: [],
      languages: [],
    };
    prismaMock.profile.findUnique.mockResolvedValue(empty);

    const result = await service.analyze('user-1', 'es');

    expect(result.score).toBe(0);
    expect(result.aiAvailable).toBe(false);
    expect(parserMock.review).not.toHaveBeenCalled();
  });

  it('no suma por "sin duplicados" cuando el perfil no tiene contenido', async () => {
    const profile = baseProfile();
    profile.skills = [];
    profile.experiences = [];

    prismaMock.profile.findUnique.mockResolvedValue(profile);

    const result = await service.analyze('user-1', 'es');

    expect(result.checks.find((c) => c.key === 'noDuplicates')?.ok).toBe(false);
  });

  it('descuenta 15 cuando falta métricas de experiencia', async () => {
    const profile = baseProfile();
    profile.experiences[0].metrics = [];
    prismaMock.profile.findUnique.mockResolvedValue(profile);

    const result = await service.analyze('user-1', 'es');

    expect(result.score).toBe(85);
    expect(result.checks.find((c) => c.key === 'experienceMetrics')?.ok).toBe(
      false,
    );
  });

  it('detecta skills duplicados sin distinguir mayúsculas ni acentos', async () => {
    const profile = baseProfile();
    profile.skills = [
      { name: 'TypeScript' },
      { name: 'typescript' },
      { name: 'Node.js' },
      { name: 'NestJS' },
      { name: 'Docker' },
    ];
    prismaMock.profile.findUnique.mockResolvedValue(profile);

    const result = await service.analyze('user-1', 'es');

    expect(result.checks.find((c) => c.key === 'noDuplicates')?.ok).toBe(false);
    expect(result.score).toBe(95);
  });

  it('marca skills insuficientes y reporta la cantidad', async () => {
    const profile = baseProfile();
    profile.skills = [{ name: 'Node.js' }, { name: 'NestJS' }, { name: 'SQL' }];
    prismaMock.profile.findUnique.mockResolvedValue(profile);

    const result = await service.analyze('user-1', 'es');

    const skills = result.checks.find((c) => c.key === 'skills');
    expect(skills?.ok).toBe(false);
    expect(skills?.detail).toBe('3');
    expect(result.score).toBe(90);
  });

  it('se degrada sin IA si el parser falla', async () => {
    prismaMock.profile.findUnique.mockResolvedValue(baseProfile());
    parserMock.review.mockRejectedValue(new Error('boom'));

    const result = await service.analyze('user-1', 'en');

    expect(result.score).toBe(100);
    expect(result.aiAvailable).toBe(false);
    expect(result.strengths).toEqual([]);
    expect(result.suggestions).toEqual([]);
    expect(result.lang).toBe('en');
  });
});
