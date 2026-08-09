import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CvExportService } from '../cv-export/cv-export.service';
import { profileFingerprint, profileSnapshot } from '../job-match/profile-util';
import type { AdaptedCvContent } from './cv-adaptation.types';
import { CvAdaptationParserService } from './cv-adaptation-parser.service';
import { CvAdaptationService } from './cv-adaptation.service';

describe('CvAdaptationService', () => {
  let service: CvAdaptationService;
  let prismaMock: {
    jobOffer: { findFirst: jest.Mock; delete: jest.Mock };
    jobMatch: { findFirst: jest.Mock; delete: jest.Mock };
    profile: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
    adaptedCv: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      delete: jest.Mock;
    };
  };
  let parserMock: { adapt: jest.Mock };
  let cvExportMock: { buildPdf: jest.Mock; buildDocx: jest.Mock };

  const profile = {
    id: 'profile-1',
    userId: 'user-1',
    headline: 'Software Engineer',
    phone: null,
    location: null,
    website: null,
    linkedin: null,
    summary: 'Original summary.',
    source: 'USER',
    experiences: [
      {
        id: 'exp-1',
        profileId: 'profile-1',
        company: 'Acme',
        position: 'Senior Engineer',
        location: 'Remote',
        startDate: new Date('2020-01-01'),
        endDate: null,
        current: true,
        description: 'Original description.',
        metrics: ['Cut latency by 40%'],
        sortOrder: 1,
        source: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    skills: [
      {
        id: 's1',
        profileId: 'profile-1',
        name: 'Angular',
        level: 3,
        sortOrder: 1,
        source: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 's2',
        profileId: 'profile-1',
        name: 'TypeScript',
        level: 4,
        sortOrder: 2,
        source: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 's3',
        profileId: 'profile-1',
        name: 'Python',
        level: 2,
        sortOrder: 3,
        source: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    education: [],
    certifications: [],
    projects: [
      {
        id: 'p1',
        profileId: 'profile-1',
        name: 'Career Analyzer',
        role: 'Owner',
        description: null,
        url: null,
        techStack: ['NestJS'],
        metrics: [],
        sortOrder: 1,
        source: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    languages: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const offer = {
    id: 'offer-1',
    userId: 'user-1',
    title: 'Senior Fullstack',
    company: 'TechCorp',
    level: 'Senior',
    responsibilities: [],
    requiredSkills: ['TypeScript', 'Angular'],
    preferredSkills: ['Docker'],
    experienceYears: 5,
    experienceSummary: null,
    education: [],
    languages: ['English'],
    keywords: ['frontend'],
    sourceLanguage: 'en',
    inputType: 'TEXT',
    rawInput: 'raw offer text',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const parserResult = {
    summary: 'Adapted summary.',
    experienceDescriptions: [
      { originalId: 'exp-1', text: 'Adapted description.' },
    ],
  };

  const content: AdaptedCvContent = {
    headline: 'Software Engineer',
    summary: 'Adapted summary.',
    experiences: [
      {
        originalId: 'exp-1',
        company: 'Acme',
        position: 'Senior Engineer',
        location: 'Remote',
        startDate: '2020-01-01T00:00:00.000Z',
        current: true,
        description: 'Adapted description.',
        metrics: ['Cut latency by 40%'],
      },
    ],
    projects: [
      {
        originalId: 'p1',
        name: 'Career Analyzer',
        role: 'Owner',
        techStack: ['NestJS'],
        metrics: [],
      },
    ],
    skills: [{ name: 'Angular' }, { name: 'TypeScript' }, { name: 'Python' }],
    education: [],
    certifications: [],
    languages: [],
  };

  const versionRow = {
    id: 'cv-1',
    userId: 'user-1',
    jobOfferId: 'offer-1',
    jobMatchId: null,
    sourceLanguage: 'en',
    content,
    offerSnapshot: {},
    profileSnapshot: {},
    profileFingerprint: 'fp-1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock = {
      jobOffer: { findFirst: jest.fn(), delete: jest.fn() },
      jobMatch: { findFirst: jest.fn(), delete: jest.fn() },
      profile: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      adaptedCv: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
    };
    parserMock = { adapt: jest.fn().mockResolvedValue(parserResult) };
    cvExportMock = { buildPdf: jest.fn(), buildDocx: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CvAdaptationService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: CvAdaptationParserService, useValue: parserMock },
        { provide: CvExportService, useValue: cvExportMock },
      ],
    }).compile();

    service = module.get(CvAdaptationService);
  });

  it('persiste una versión con skills de la intersección primero y prosa adaptada', async () => {
    prismaMock.jobOffer.findFirst.mockResolvedValue(offer);
    prismaMock.profile.findUnique.mockResolvedValue(profile);
    prismaMock.adaptedCv.create.mockResolvedValue(versionRow);

    const result = await service.createForOffer('user-1', 'offer-1');

    expect(prismaMock.jobOffer.findFirst).toHaveBeenCalledWith({
      where: { id: 'offer-1', userId: 'user-1' },
    });
    expect(parserMock.adapt).toHaveBeenCalledWith(
      expect.objectContaining({
        matchedSkills: ['Angular', 'TypeScript'],
        missingSkills: ['Docker'],
        sourceLanguage: 'en',
      }) as object,
    );
    const createCall = prismaMock.adaptedCv.create.mock
      .calls[0] as unknown as Array<{
      data: {
        content: AdaptedCvContent;
        jobOfferId: string;
        sourceLanguage: string;
        profileFingerprint: string;
      };
    }>;
    expect(createCall[0].data.jobOfferId).toBe('offer-1');
    expect(createCall[0].data.sourceLanguage).toBe('en');
    expect(createCall[0].data.content.skills.map((s) => s.name)).toEqual([
      'Angular',
      'TypeScript',
      'Python',
    ]);
    expect(createCall[0].data.content.summary).toContain(
      'Software Engineer, with over',
    );
    expect(createCall[0].data.content.experiences[0].description).toBe(
      'Adapted description.',
    );
    expect(createCall[0].data.content.experiences[0].company).toBe('Acme');
    expect(createCall[0].data.content.projects[0].techStack).toEqual([
      'NestJS',
    ]);
    expect(createCall[0].data.profileFingerprint).toEqual(expect.any(String));
    expect(result.id).toBe('cv-1');
  });

  it('ignora un originalId desconocido devuelto por la IA', async () => {
    parserMock.adapt.mockResolvedValue({
      summary: 'Adapted summary.',
      experienceDescriptions: [{ originalId: 'exp-999', text: 'huérfano' }],
    });
    prismaMock.jobOffer.findFirst.mockResolvedValue(offer);
    prismaMock.profile.findUnique.mockResolvedValue(profile);
    prismaMock.adaptedCv.create.mockResolvedValue(versionRow);

    await service.createForOffer('user-1', 'offer-1');

    const createCall = prismaMock.adaptedCv.create.mock
      .calls[0] as unknown as Array<{ data: { content: AdaptedCvContent } }>;
    expect(createCall[0].data.content.experiences[0].description).toBe(
      'Original description.',
    );
  });

  it('lanza 404 con una oferta ajena o inexistente', async () => {
    prismaMock.jobOffer.findFirst.mockResolvedValue(null);

    await expect(service.createForOffer('user-2', 'offer-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(parserMock.adapt).not.toHaveBeenCalled();
  });

  it('lanza 404 cuando el jobMatchId es ajeno o inexistente', async () => {
    prismaMock.jobOffer.findFirst.mockResolvedValue(offer);
    prismaMock.jobMatch.findFirst.mockResolvedValue(null);

    await expect(
      service.createForOffer('user-1', 'offer-1', 'match-ajeno'),
    ).rejects.toThrow(NotFoundException);
    expect(parserMock.adapt).not.toHaveBeenCalled();
  });

  it('pasa los gaps MISSING del match al parser para que no se afirmen', async () => {
    prismaMock.jobOffer.findFirst.mockResolvedValue(offer);
    prismaMock.jobMatch.findFirst.mockResolvedValue({
      id: 'match-1',
      userId: 'user-1',
      gaps: [
        { name: 'NestJS', status: 'MISSING', source: 'REQUIRED' },
        { name: 'Docker', status: 'HAVE', source: 'PREFERRED' },
      ],
    });
    prismaMock.profile.findUnique.mockResolvedValue(profile);
    prismaMock.adaptedCv.create.mockResolvedValue(versionRow);

    await service.createForOffer('user-1', 'offer-1', 'match-1');

    expect(parserMock.adapt).toHaveBeenCalledWith(
      expect.objectContaining({
        missingSkills: ['Docker', 'NestJS'],
      }) as object,
    );
    const createCall = prismaMock.adaptedCv.create.mock
      .calls[0] as unknown as Array<{ data: { jobMatchId: string } }>;
    expect(createCall[0].data.jobMatchId).toBe('match-1');
  });

  it('calcula stale comparando huellas en getById', async () => {
    prismaMock.adaptedCv.findFirst.mockResolvedValue({
      ...versionRow,
      profileFingerprint: 'huella-diferente',
    });
    prismaMock.profile.findUnique.mockResolvedValue(profile);

    const result = await service.getById('user-1', 'cv-1');
    expect(result.stale).toBe(true);

    prismaMock.adaptedCv.findFirst.mockResolvedValue({
      ...versionRow,
      profileFingerprint: profileFingerprint(profileSnapshot(profile as never)),
    });
    const fresh = await service.getById('user-1', 'cv-1');
    expect(fresh.stale).toBe(false);
  });

  it('lanza 404 con una versión ajena o inexistente', async () => {
    prismaMock.adaptedCv.findFirst.mockResolvedValue(null);

    await expect(service.getById('user-2', 'cv-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('exporta con la plantilla en el idioma de la oferta (lang resuelto)', async () => {
    prismaMock.adaptedCv.findFirst.mockResolvedValue(versionRow);
    prismaMock.user.findUnique.mockResolvedValue({
      name: 'Juan Pérez',
      email: 'juan@test.dev',
    });
    cvExportMock.buildDocx.mockResolvedValue(Buffer.from('docx-buffer'));
    cvExportMock.buildPdf.mockResolvedValue(Buffer.from('pdf-buffer'));

    const docx = await service.exportCv('user-1', 'cv-1', 'docx');
    expect(cvExportMock.buildDocx).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Juan Pérez',
        summary: 'Adapted summary.',
        skills: expect.arrayContaining([
          { name: 'Angular', level: 0 },
          { name: 'Python', level: 0 },
        ]) as object,
      }) as object,
      'en',
    );
    expect(docx.candidateName).toBe('Juan Pérez');

    await service.exportCv('user-1', 'cv-1', 'pdf', 'es');
    expect(cvExportMock.buildPdf).toHaveBeenCalledWith(
      expect.any(Object),
      'es',
    );
  });

  it('lanza 404 al exportar una versión ajena', async () => {
    prismaMock.adaptedCv.findFirst.mockResolvedValue(null);

    await expect(service.exportCv('user-2', 'cv-1', 'pdf')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('borra solo la versión, sin tocar la oferta ni el match', async () => {
    prismaMock.adaptedCv.findFirst.mockResolvedValue(versionRow);
    prismaMock.adaptedCv.delete.mockResolvedValue(versionRow);

    await service.remove('user-1', 'cv-1');

    expect(prismaMock.adaptedCv.delete).toHaveBeenCalledWith({
      where: { id: 'cv-1' },
    });
    expect(prismaMock.jobOffer.delete).not.toHaveBeenCalled();
    expect(prismaMock.jobMatch.delete).not.toHaveBeenCalled();
  });
});
