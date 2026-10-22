import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JobAnalysisService } from '../job-analysis/job-analysis.service';
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
  let jobAnalysisMock: { createFromDraft: jest.Mock };

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
    aiScore: 78,
    coverage: null,
    scoringVersion: 2,
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
    jobAnalysisMock = { createFromDraft: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobMatchService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JobMatchParserService, useValue: parserMock },
        { provide: JobAnalysisService, useValue: jobAnalysisMock },
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

  it('pondera cobertura y score de IA y persiste la versión de cálculo', async () => {
    const profileWithSkills = {
      ...emptyProfile,
      skills: [
        { name: 'TypeScript', level: 4 },
        { name: 'NestJS', level: 4 },
      ],
    };
    prismaMock.jobOffer.findFirst.mockResolvedValue({
      id: 'offer-1',
      title: 'Senior Software Engineer',
      company: 'Acme',
      level: 'Senior',
      responsibilities: [],
      requiredSkills: ['TypeScript', 'NestJS', 'Docker'],
      preferredSkills: [],
      experienceYears: null,
      experienceSummary: null,
      education: [],
      languages: [],
      keywords: [],
    });
    prismaMock.profile.findUnique.mockResolvedValue(profileWithSkills);
    parserMock.match.mockResolvedValue({ ...analysis, overallScore: 60 });
    prismaMock.jobMatch.create.mockResolvedValue(matchRow);

    await service.createForOffer('user-1', 'offer-1', 'es');

    expect(prismaMock.jobMatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        overallScore: 64, // round(0.5 * 67 + 0.5 * 60)
        aiScore: 60,
        coverage: 67,
        scoringVersion: 2,
      }) as object,
    });
  });

  it('marca como recalculable un match de la versión anterior', async () => {
    prismaMock.jobMatch.findFirst.mockResolvedValue({
      ...matchRow,
      coverage: null,
      scoringVersion: 1,
    });
    prismaMock.profile.findUnique.mockResolvedValue(emptyProfile);

    const result = await service.getById('user-1', 'match-1');

    expect(result.needsRecalculation).toBe(true);
    expect(result.coverage).toBeNull();
    expect(result.scoringVersion).toBe(1);
  });

  it('expone la cobertura de un match de la versión actual', async () => {
    prismaMock.jobMatch.findFirst.mockResolvedValue({
      ...matchRow,
      coverage: 50,
      offerSnapshot: { requiredSkills: ['TypeScript', 'Docker'] },
      profileSnapshot: { skills: [{ name: 'TypeScript', level: 4 }] },
    });
    prismaMock.profile.findUnique.mockResolvedValue(emptyProfile);

    const result = await service.getById('user-1', 'match-1');

    expect(result.needsRecalculation).toBe(false);
    expect(result.coverage).toEqual({
      matched: ['TypeScript'],
      total: 2,
      percent: 50,
    });
  });

  it('lanza 404 al crear un match de una oferta ajena o inexistente', async () => {
    prismaMock.jobOffer.findFirst.mockResolvedValue(null);

    await expect(
      service.createForOffer('user-2', 'offer-1', 'es'),
    ).rejects.toThrow(NotFoundException);
    expect(parserMock.match).not.toHaveBeenCalled();
  });

  it('pasa el perfil localizado en el idioma del match al parser', async () => {
    const bilingualProfile = {
      ...emptyProfile,
      experiences: [
        {
          id: 'exp-1',
          profileId: 'profile-1',
          company: 'Acme',
          position: 'Puesto ES',
          positionEn: 'Position EN',
          description: 'Descripción ES',
          descriptionEn: 'Description EN',
          location: null,
          startDate: null,
          endDate: null,
          current: true,
          metrics: [],
          sortOrder: 1,
          source: 'USER',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };
    prismaMock.jobOffer.findFirst.mockResolvedValue({
      id: 'offer-1',
      title: 'Senior',
      company: 'Acme',
      level: 'Senior',
      responsibilities: [],
      requiredSkills: ['TypeScript'],
      preferredSkills: [],
      experienceYears: null,
      experienceSummary: null,
      education: [],
      languages: [],
      keywords: [],
    });
    prismaMock.profile.findUnique.mockResolvedValue(bilingualProfile);
    prismaMock.jobMatch.create.mockResolvedValue(matchRow);

    await service.createForOffer('user-1', 'offer-1', 'en');

    const matchCall = parserMock.match.mock.calls[0] as unknown as Array<{
      snapshot: {
        experiences: Array<{ position: string; description: string }>;
      };
    }>;
    const snapshot = matchCall[0]?.snapshot ?? matchCall[1];
    expect(snapshot.experiences[0].position).toBe('Position EN');
    expect(snapshot.experiences[0].description).toBe('Description EN');
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

  it('guarda la oferta de un match sin oferta y la vincula', async () => {
    const unsaved = { ...matchRow, jobOfferId: null };
    const savedOffer = {
      id: 'offer-new',
      title: 'Senior Software Engineer',
      company: 'Acme',
      url: null,
    };
    prismaMock.jobMatch.findFirst.mockResolvedValue(unsaved);
    jobAnalysisMock.createFromDraft.mockResolvedValue({ id: 'offer-new' });
    prismaMock.jobMatch.update.mockResolvedValue({
      ...unsaved,
      jobOfferId: 'offer-new',
      jobOffer: savedOffer,
    });

    const result = await service.saveOffer('user-1', 'match-1');

    expect(jobAnalysisMock.createFromDraft).toHaveBeenCalledWith(
      'user-1',
      matchRow.offerSnapshot,
    );
    expect(prismaMock.jobMatch.update).toHaveBeenCalledWith({
      where: { id: 'match-1' },
      data: { jobOfferId: 'offer-new' },
      include: { jobOffer: { select: expect.any(Object) as object } },
    });
    expect(result.offer.saved).toBe(true);
    expect(result.offer.id).toBe('offer-new');
  });

  it('rechaza guardar la oferta si el match ya la tiene', async () => {
    prismaMock.jobMatch.findFirst.mockResolvedValue(matchRow);

    await expect(service.saveOffer('user-1', 'match-1')).rejects.toMatchObject({
      response: { code: 'OFFER_ALREADY_SAVED' },
    });
    expect(jobAnalysisMock.createFromDraft).not.toHaveBeenCalled();
  });

  it('no guarda la oferta de un match ajeno', async () => {
    prismaMock.jobMatch.findFirst.mockResolvedValue(null);

    await expect(service.saveOffer('user-2', 'match-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('expone contexto de oferta con título y empresa en el detalle', async () => {
    prismaMock.jobMatch.findFirst.mockResolvedValue({
      ...matchRow,
      offerSnapshot: { title: 'Fallback', company: 'Snapshot Co' },
      jobOffer: {
        id: 'offer-1',
        title: 'Senior Software Engineer',
        company: 'Acme',
        url: 'https://jobs.example.com/1',
      },
    });

    const result = await service.getById('user-1', 'match-1');

    expect(result.offer).toEqual({
      id: 'offer-1',
      title: 'Senior Software Engineer',
      company: 'Acme',
      url: 'https://jobs.example.com/1',
      saved: true,
    });
  });
});
