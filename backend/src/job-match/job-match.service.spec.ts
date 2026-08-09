import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import {
  JobMatchParserService,
  type MatchAnalysis,
} from './job-match-parser.service';
import { JobMatchService } from './job-match.service';
import { profileFingerprint, profileSnapshot } from './profile-util';

describe('JobMatchService', () => {
  let service: JobMatchService;
  let prismaMock: {
    jobOffer: {
      findFirst: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
    };
    profile: { findUnique: jest.Mock };
    jobMatch: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let parserMock: { match: jest.Mock };

  const emptyProfile = {
    id: 'profile-1',
    userId: 'user-1',
    headline: null,
    phone: null,
    location: null,
    website: null,
    linkedin: null,
    summary: null,
    source: 'USER',
    experiences: [],
    skills: [],
    education: [],
    certifications: [],
    projects: [],
    languages: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const analysis: MatchAnalysis = {
    overallScore: 78,
    overallJustification: 'Sólido encaje.',
    dimensions: [
      { key: 'skills', score: 80, justification: 'TypeScript.' },
      { key: 'experience', score: null, justification: 'Sin experiencias.' },
      { key: 'education', score: null, justification: 'Sin educación.' },
      { key: 'languages', score: null, justification: 'Sin idiomas.' },
    ],
    gaps: [
      {
        name: 'NestJS',
        status: 'MISSING',
        source: 'REQUIRED',
        note: 'No hay evidencia.',
      },
    ],
    recommendations: [
      {
        type: 'SKILL',
        target: 'NestJS',
        suggestion: 'Sumar un proyecto.',
      },
    ],
  };

  const matchRow = {
    id: 'match-1',
    userId: 'user-1',
    jobOfferId: 'offer-1',
    lang: 'es',
    overallScore: 78,
    overallJustification: 'Sólido encaje.',
    dimensions: analysis.dimensions,
    gaps: analysis.gaps,
    recommendations: analysis.recommendations,
    offerSnapshot: {},
    profileSnapshot: {},
    profileFingerprint: profileFingerprint(
      profileSnapshot(emptyProfile as never),
    ),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock = {
      jobOffer: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      profile: { findUnique: jest.fn() },
      jobMatch: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    parserMock = { match: jest.fn().mockResolvedValue(analysis) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobMatchService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JobMatchParserService, useValue: parserMock },
      ],
    }).compile();

    service = module.get(JobMatchService);
  });

  it('crea un match a partir de una oferta guardada del usuario', async () => {
    prismaMock.jobOffer.findFirst.mockResolvedValue({
      id: 'offer-1',
      title: 'Senior Software Engineer',
      company: 'Acme',
      level: 'Senior',
      responsibilities: [],
      requiredSkills: ['TypeScript', 'NestJS'],
      preferredSkills: ['Angular'],
      experienceYears: 5,
      experienceSummary: null,
      education: [],
      languages: ['English'],
      keywords: [],
    });
    prismaMock.profile.findUnique.mockResolvedValue(emptyProfile);
    prismaMock.jobMatch.create.mockResolvedValue(matchRow);

    const result = await service.createForOffer('user-1', 'offer-1', 'es');

    expect(prismaMock.jobOffer.findFirst).toHaveBeenCalledWith({
      where: { id: 'offer-1', userId: 'user-1' },
    });
    expect(parserMock.match).toHaveBeenCalled();
    expect(prismaMock.jobMatch.create).toHaveBeenCalled();
    expect(result.id).toBe('match-1');
  });

  it('lanza 404 al crear un match de una oferta ajena o inexistente', async () => {
    prismaMock.jobOffer.findFirst.mockResolvedValue(null);

    await expect(
      service.createForOffer('user-2', 'offer-1', 'es'),
    ).rejects.toThrow(NotFoundException);
    expect(parserMock.match).not.toHaveBeenCalled();
  });

  it('persiste la oferta cuando saveOffer es true en el flujo de draft', async () => {
    prismaMock.profile.findUnique.mockResolvedValue(emptyProfile);
    prismaMock.jobOffer.create.mockResolvedValue({ id: 'offer-new' });
    prismaMock.jobMatch.create.mockResolvedValue(matchRow);

    await service.createForDraft(
      'user-1',
      { title: 'Senior Software Engineer', rawInput: 'texto original' },
      true,
      'es',
    );

    expect(prismaMock.jobOffer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          title: 'Senior Software Engineer',
          rawInput: 'texto original',
        }) as object,
      }),
    );
    expect(prismaMock.jobMatch.create).toHaveBeenCalled();
  });

  it('no persiste la oferta cuando saveOffer es false', async () => {
    prismaMock.profile.findUnique.mockResolvedValue(emptyProfile);
    prismaMock.jobMatch.create.mockResolvedValue(matchRow);

    await service.createForDraft(
      'user-1',
      { title: 'Senior Software Engineer' },
      false,
      'es',
    );

    expect(prismaMock.jobOffer.create).not.toHaveBeenCalled();
    expect(prismaMock.jobMatch.create).toHaveBeenCalled();
  });

  it('filtra los gaps que no están en la whitelist de la oferta', async () => {
    const outOfOffer: MatchAnalysis = {
      ...analysis,
      gaps: [
        {
          name: 'NestJS',
          status: 'MISSING',
          source: 'REQUIRED',
        },
        {
          name: 'React',
          status: 'MISSING',
          source: 'PREFERRED',
        },
      ],
    };
    parserMock.match.mockResolvedValue(outOfOffer);
    prismaMock.profile.findUnique.mockResolvedValue(emptyProfile);
    prismaMock.jobMatch.create.mockResolvedValue({
      id: 'match-1',
      userId: 'user-1',
      jobOfferId: null,
      lang: 'es',
      overallScore: analysis.overallScore,
      overallJustification: analysis.overallJustification,
      dimensions: analysis.dimensions,
      gaps: analysis.gaps,
      recommendations: analysis.recommendations,
      profileFingerprint: profileFingerprint(
        profileSnapshot(emptyProfile as never),
      ),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.createForDraft(
      'user-1',
      {
        title: 'Senior Software Engineer',
        requiredSkills: ['NestJS'],
        preferredSkills: ['Angular'],
        experienceSummary: null,
      },
      false,
      'es',
    );

    // React no está en la oferta → se descarta.
    expect(result.gaps.map((g) => g.name)).toEqual(['NestJS']);
  });

  it('calcula stale al comparar la huella del perfil actual y la guardada', async () => {
    prismaMock.jobMatch.findFirst.mockResolvedValue({
      ...matchRow,
      profileFingerprint: 'fingerprint-diferente',
    });
    prismaMock.profile.findUnique.mockResolvedValue(emptyProfile);

    const result = await service.getById('user-1', 'match-1');

    expect(result.stale).toBe(true);
  });

  it('devuelve stale false cuando la huella coincide', async () => {
    prismaMock.jobMatch.findFirst.mockResolvedValue(matchRow);
    prismaMock.profile.findUnique.mockResolvedValue(emptyProfile);

    const result = await service.getById('user-1', 'match-1');

    expect(result.stale).toBe(false);
  });

  it('lanza 404 con un match ajeno o inexistente', async () => {
    prismaMock.jobMatch.findFirst.mockResolvedValue(null);

    await expect(service.getById('user-2', 'match-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('recalcula un match preservando el id', async () => {
    prismaMock.jobMatch.findFirst.mockResolvedValue(matchRow);
    prismaMock.jobOffer.findUnique.mockResolvedValue({
      id: 'offer-1',
      title: 'Senior Software Engineer',
      company: 'Acme',
      level: 'Senior',
      responsibilities: [],
      requiredSkills: ['TypeScript', 'NestJS'],
      preferredSkills: ['Angular'],
      experienceYears: 5,
      experienceSummary: null,
      education: [],
      languages: ['English'],
      keywords: [],
    });
    prismaMock.profile.findUnique.mockResolvedValue(emptyProfile);
    prismaMock.jobMatch.update.mockResolvedValue(matchRow);

    const result = await service.recompute('user-1', 'match-1');

    expect(prismaMock.jobMatch.update).toHaveBeenCalledWith({
      where: { id: 'match-1' },
      data: expect.objectContaining({
        profileFingerprint: expect.any(String) as string,
      }) as object,
    });
    expect(prismaMock.jobMatch.create).not.toHaveBeenCalled();
    expect(result.id).toBe('match-1');
  });

  it('borra un match propio y no toca la oferta', async () => {
    prismaMock.jobMatch.findFirst.mockResolvedValue(matchRow);
    prismaMock.jobMatch.delete.mockResolvedValue(matchRow);

    await service.remove('user-1', 'match-1');

    expect(prismaMock.jobMatch.delete).toHaveBeenCalledWith({
      where: { id: 'match-1' },
    });
    expect(prismaMock.jobOffer.delete).toBeUndefined();
  });

  it('no borra un match ajeno', async () => {
    prismaMock.jobMatch.findFirst.mockResolvedValue(null);

    await expect(service.remove('user-2', 'match-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prismaMock.jobMatch.delete).not.toHaveBeenCalled();
  });
});
