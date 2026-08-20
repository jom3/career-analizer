import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { profileFingerprint, profileSnapshot } from '../job-match/profile-util';
import type { LetterDocument } from './cover-letter-document.service';
import { CoverLetterDocumentService } from './cover-letter-document.service';
import { CoverLetterParserService } from './cover-letter-parser.service';
import { CoverLetterService } from './cover-letter.service';

describe('CoverLetterService', () => {
  let service: CoverLetterService;
  let parserMock: { generate: jest.Mock };
  let documentMock: {
    buildLetterPdf: jest.Mock;
    buildLetterDocx: jest.Mock;
  };
  let prismaMock: {
    jobOffer: { findFirst: jest.Mock; delete: jest.Mock };
    profile: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
    jobMatch: { findFirst: jest.Mock };
    coverLetter: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      delete: jest.Mock;
    };
  };

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
    experiences: [],
    skills: [
      {
        id: 's1',
        profileId: 'profile-1',
        name: 'TypeScript',
        level: 4,
        sortOrder: 1,
        source: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    education: [],
    certifications: [],
    projects: [],
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
    responsibilities: ['Build software'],
    requiredSkills: ['TypeScript'],
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

  const letterRow = {
    id: 'letter-1',
    userId: 'user-1',
    jobOfferId: 'offer-1',
    recruiterName: 'María López',
    note: 'Vi la vacante en LinkedIn.',
    sourceLanguage: 'en',
    content:
      'Dear María López,\n\nI am very interested in this position.\n\nSincerely,',
    offerSnapshot: offer,
    profileSnapshot: {},
    profileFingerprint: 'fp-1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock = {
      jobOffer: { findFirst: jest.fn(), delete: jest.fn() },
      profile: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      jobMatch: { findFirst: jest.fn() },
      coverLetter: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
    };
    parserMock = {
      generate: jest.fn().mockResolvedValue({
        content: 'Generated draft content.',
      }),
    };
    documentMock = {
      buildLetterPdf: jest.fn(),
      buildLetterDocx: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoverLetterService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: CoverLetterParserService, useValue: parserMock },
        { provide: CoverLetterDocumentService, useValue: documentMock },
      ],
    }).compile();

    service = module.get(CoverLetterService);
  });

  it('genera un borrador sin persistir nada', async () => {
    prismaMock.jobOffer.findFirst.mockResolvedValue(offer);
    prismaMock.profile.findUnique.mockResolvedValue(profile);
    prismaMock.jobMatch.findFirst.mockResolvedValue(null);

    const result = await service.buildDraft(
      'user-1',
      'offer-1',
      'María López',
      'Vi la vacante en LinkedIn.',
      'en',
    );

    expect(prismaMock.jobOffer.findFirst).toHaveBeenCalledWith({
      where: { id: 'offer-1', userId: 'user-1' },
    });
    expect(prismaMock.jobMatch.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', jobOfferId: 'offer-1' },
      orderBy: { createdAt: 'desc' },
      select: {
        overallScore: true,
        overallJustification: true,
        dimensions: true,
        gaps: true,
      },
    });
    expect(parserMock.generate).toHaveBeenCalledWith({
      profile: expect.any(Object) as object,
      offer: {
        title: 'Senior Fullstack',
        company: 'TechCorp',
        responsibilities: ['Build software'],
        requiredSkills: ['TypeScript'],
        preferredSkills: ['Docker'],
        experienceSummary: null,
        keywords: ['frontend'],
      },
      recruiterName: 'María López',
      note: 'Vi la vacante en LinkedIn.',
      lang: 'en',
      match: null,
    });
    expect(result.content).toBe('Generated draft content.');
    expect(result.sourceLanguage).toBe('en');
    expect(prismaMock.coverLetter.create).not.toHaveBeenCalled();
  });

  it('pasa el match más reciente de la oferta al parser', async () => {
    prismaMock.jobOffer.findFirst.mockResolvedValue(offer);
    prismaMock.profile.findUnique.mockResolvedValue(profile);
    prismaMock.jobMatch.findFirst.mockResolvedValue({
      overallScore: 85,
      overallJustification: 'Strong fit.',
      dimensions: [
        {
          key: 'skills',
          score: 90,
          justification: 'TypeScript is highly relevant.',
        },
      ],
      gaps: [
        { name: 'TypeScript', status: 'HAVE' },
        { name: 'Docker', status: 'PARTIAL' },
      ],
    });

    await service.buildDraft('user-1', 'offer-1', null, null);

    expect(parserMock.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        match: {
          overallScore: 85,
          overallJustification: 'Strong fit.',
          dimensions: [
            {
              key: 'skills',
              score: 90,
              justification: 'TypeScript is highly relevant.',
            },
          ],
          gaps: [
            { name: 'TypeScript', status: 'HAVE' },
            { name: 'Docker', status: 'PARTIAL' },
          ],
        },
      }) as object,
    );
  });

  it('usa el idioma de la interfaz, no el de la oferta', async () => {
    prismaMock.jobOffer.findFirst.mockResolvedValue(offer);
    prismaMock.profile.findUnique.mockResolvedValue(profile);
    prismaMock.jobMatch.findFirst.mockResolvedValue(null);

    await service.buildDraft('user-1', 'offer-1', null, null, 'es');

    expect(parserMock.generate).toHaveBeenCalledWith(
      expect.objectContaining({ lang: 'es' }) as object,
    );
  });

  it('selecciona el perfil bilingüe en el idioma de la interfaz', async () => {
    const bilingualProfile = {
      ...profile,
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
    prismaMock.jobOffer.findFirst.mockResolvedValue(offer);
    prismaMock.profile.findUnique.mockResolvedValue(bilingualProfile);
    prismaMock.jobMatch.findFirst.mockResolvedValue(null);

    await service.buildDraft('user-1', 'offer-1', null, null, 'en');

    const generateCall = parserMock.generate.mock.calls[0] as unknown as Array<{
      profile: {
        experiences: Array<{ position: string; description: string }>;
      };
    }>;
    expect(generateCall[0].profile.experiences[0].position).toBe('Position EN');
    expect(generateCall[0].profile.experiences[0].description).toBe(
      'Description EN',
    );
  });

  it('lanza 404 con una oferta ajena o inexistente en el borrador', async () => {
    prismaMock.jobOffer.findFirst.mockResolvedValue(null);

    await expect(
      service.buildDraft('user-2', 'offer-1', null, null),
    ).rejects.toThrow(NotFoundException);
    expect(parserMock.generate).not.toHaveBeenCalled();
  });

  it('persiste la carta final editada con snapshots y huella', async () => {
    prismaMock.jobOffer.findFirst.mockResolvedValue(offer);
    prismaMock.profile.findUnique.mockResolvedValue(profile);
    prismaMock.coverLetter.create.mockResolvedValue(letterRow);

    const result = await service.create(
      'user-1',
      'offer-1',
      'María López',
      'Vi la vacante en LinkedIn.',
      'Dear María López, edited content.',
      'en',
    );

    const createCall = prismaMock.coverLetter.create.mock
      .calls[0] as unknown as Array<{
      data: {
        jobOfferId: string;
        recruiterName: string;
        note: string;
        sourceLanguage: string;
        content: string;
        offerSnapshot: { title: string };
        profileSnapshot: unknown;
        profileFingerprint: string;
      };
    }>;
    expect(createCall[0].data.jobOfferId).toBe('offer-1');
    expect(createCall[0].data.recruiterName).toBe('María López');
    expect(createCall[0].data.note).toBe('Vi la vacante en LinkedIn.');
    expect(createCall[0].data.sourceLanguage).toBe('en');
    expect(createCall[0].data.content).toBe(
      'Dear María López, edited content.',
    );
    expect(createCall[0].data.offerSnapshot.title).toBe('Senior Fullstack');
    expect(createCall[0].data.profileFingerprint).toEqual(expect.any(String));
    expect(result.id).toBe('letter-1');
    expect(result.stale).toBe(false);
  });

  it('lanza 404 con una oferta ajena al crear', async () => {
    prismaMock.jobOffer.findFirst.mockResolvedValue(null);

    await expect(
      service.create('user-2', 'offer-1', null, null, 'content'),
    ).rejects.toThrow(NotFoundException);
    expect(prismaMock.coverLetter.create).not.toHaveBeenCalled();
  });

  it('marca stale comparando la huella en getById', async () => {
    prismaMock.coverLetter.findFirst.mockResolvedValue({
      ...letterRow,
      profileFingerprint: 'huella-diferente',
    });
    prismaMock.profile.findUnique.mockResolvedValue(profile);

    const result = await service.getById('user-1', 'letter-1');
    expect(result.stale).toBe(true);

    prismaMock.coverLetter.findFirst.mockResolvedValue({
      ...letterRow,
      profileFingerprint: profileFingerprint(profileSnapshot(profile as never)),
    });
    const fresh = await service.getById('user-1', 'letter-1');
    expect(fresh.stale).toBe(false);
  });

  it('lanza 404 con una carta ajena en getById', async () => {
    prismaMock.coverLetter.findFirst.mockResolvedValue(null);

    await expect(service.getById('user-2', 'letter-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('exporta armando fecha, asunto y firma deterministas según lang', async () => {
    prismaMock.coverLetter.findFirst.mockResolvedValue(letterRow);
    prismaMock.user.findUnique.mockResolvedValue({
      name: 'Juan Pérez',
      email: 'juan@test.dev',
    });
    documentMock.buildLetterDocx.mockResolvedValue(Buffer.from('docx-buffer'));
    documentMock.buildLetterPdf.mockResolvedValue(Buffer.from('pdf-buffer'));

    const docx = await service.exportLetter('user-1', 'letter-1', 'docx');
    const docCalls = documentMock.buildLetterDocx.mock
      .calls as unknown as Array<[LetterDocument]>;
    const docArgument = docCalls[0][0];
    expect(docx.candidateName).toBe('Juan Pérez');
    expect(docArgument.subject).toBe('Re: Senior Fullstack — TechCorp');
    expect(docArgument.content).toBe(letterRow.content);
    expect(docArgument.signature).toBe('Juan Pérez — juan@test.dev');
    expect(docArgument.lang).toBe('en');
    expect(docx.buffer.toString()).toBe('docx-buffer');

    await service.exportLetter('user-1', 'letter-1', 'pdf', 'es');
    const pdfCalls = documentMock.buildLetterPdf.mock.calls as unknown as Array<
      [LetterDocument]
    >;
    const pdfArgument = pdfCalls[0][0];
    expect(pdfArgument.lang).toBe('es');
  });

  it('lanza 404 al exportar una carta ajena', async () => {
    prismaMock.coverLetter.findFirst.mockResolvedValue(null);

    await expect(
      service.exportLetter('user-2', 'letter-1', 'pdf'),
    ).rejects.toThrow(NotFoundException);
  });

  it('borra solo la carta, sin tocar la oferta', async () => {
    prismaMock.coverLetter.findFirst.mockResolvedValue(letterRow);
    prismaMock.coverLetter.delete.mockResolvedValue(letterRow);

    await service.remove('user-1', 'letter-1');

    expect(prismaMock.coverLetter.delete).toHaveBeenCalledWith({
      where: { id: 'letter-1' },
    });
    expect(prismaMock.jobOffer.delete).not.toHaveBeenCalled();
  });
});
