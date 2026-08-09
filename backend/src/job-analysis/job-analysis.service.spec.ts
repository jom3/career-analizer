import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { TextExtractorService } from '../cv-import/text-extractor.service';
import { JobParserService } from './job-parser.service';
import { JobAnalysisService } from './job-analysis.service';
import { JobOfferDto } from './dto/job-offer.dto';
import { InputType } from '../generated/prisma/enums.js';

describe('JobAnalysisService', () => {
  let service: JobAnalysisService;
  let prismaMock: {
    jobOffer: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let parserMock: { parseText: jest.Mock; parseImage: jest.Mock };
  let extractorMock: { extract: jest.Mock };

  const draft = {
    title: 'Senior Software Engineer',
    company: 'Acme',
    level: 'Senior',
    responsibilities: [],
    requiredSkills: [],
    preferredSkills: [],
    experienceYears: null,
    experienceSummary: null,
    education: [],
    languages: [],
    keywords: [],
  };

  const pdfFile = {
    buffer: Buffer.from('%PDF-1.4\nbinary'),
    mimetype: 'application/pdf',
    originalname: 'offer.pdf',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock = {
      jobOffer: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    parserMock = {
      parseText: jest.fn().mockResolvedValue({ draft, sourceLanguage: 'es' }),
      parseImage: jest.fn().mockResolvedValue({ draft, sourceLanguage: 'es' }),
    };
    extractorMock = { extract: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobAnalysisService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JobParserService, useValue: parserMock },
        { provide: TextExtractorService, useValue: extractorMock },
      ],
    }).compile();

    service = module.get(JobAnalysisService);
  });

  it('analiza texto pegado con inputType TEXT y rawInput', async () => {
    const result = await service.analyze('Oferta de trabajo', undefined);

    expect(parserMock.parseText).toHaveBeenCalledWith('Oferta de trabajo');
    expect(result).toEqual({
      draft,
      sourceLanguage: 'es',
      inputType: InputType.TEXT,
      rawInput: 'Oferta de trabajo',
    });
  });

  it('analiza una imagen con inputType IMAGE y rawInput null', async () => {
    const imageFile = {
      buffer: Buffer.from('png'),
      mimetype: 'image/png',
      originalname: 'offer.png',
    };

    const result = await service.analyze(undefined, imageFile);

    expect(parserMock.parseImage).toHaveBeenCalledWith(
      Buffer.from('png'),
      'image/png',
    );
    expect(result.inputType).toBe(InputType.IMAGE);
    expect(result.rawInput).toBeNull();
  });

  it('analiza un PDF extrayendo el texto y con inputType PDF', async () => {
    extractorMock.extract.mockResolvedValue('texto extraído de la oferta');

    const result = await service.analyze(undefined, pdfFile);

    expect(extractorMock.extract).toHaveBeenCalledWith(
      Buffer.from('%PDF-1.4\nbinary'),
      'application/pdf',
    );
    expect(parserMock.parseText).toHaveBeenCalledWith(
      'texto extraído de la oferta',
    );
    expect(result.inputType).toBe(InputType.PDF);
    expect(result.rawInput).toBe('texto extraído de la oferta');
  });

  it('rechaza con 400 si no hay texto ni archivo', async () => {
    await expect(service.analyze(undefined, undefined)).rejects.toThrow(
      BadRequestException,
    );
    expect(parserMock.parseText).not.toHaveBeenCalled();
  });

  it('rechaza con 400 si hay texto y archivo a la vez', async () => {
    await expect(service.analyze('texto', pdfFile)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rechaza con 400 un archivo que no es imagen ni PDF/DOCX', async () => {
    const txtFile = {
      buffer: Buffer.from('plain text'),
      mimetype: 'text/plain',
      originalname: 'offer.txt',
    };

    await expect(service.analyze(undefined, txtFile)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('persiste la oferta con los defaults de inputType y rawInput', async () => {
    const dto = new JobOfferDto();
    dto.title = 'Senior Software Engineer';

    await service.create('user-1', dto);

    expect(prismaMock.jobOffer.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        title: 'Senior Software Engineer',
        company: null,
        level: null,
        responsibilities: [],
        requiredSkills: [],
        preferredSkills: [],
        experienceYears: null,
        experienceSummary: null,
        education: [],
        languages: [],
        keywords: [],
        sourceLanguage: null,
        inputType: InputType.TEXT,
        rawInput: null,
      },
    });
  });

  it('lista solo las ofertas del usuario', async () => {
    prismaMock.jobOffer.findMany.mockResolvedValue([]);

    await service.list('user-1');

    expect(prismaMock.jobOffer.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('devuelve la oferta propia del usuario', async () => {
    const row = { id: 'offer-1', userId: 'user-1' };
    prismaMock.jobOffer.findFirst.mockResolvedValue(row);

    const result = await service.getById('user-1', 'offer-1');

    expect(prismaMock.jobOffer.findFirst).toHaveBeenCalledWith({
      where: { id: 'offer-1', userId: 'user-1' },
    });
    expect(result).toBe(row);
  });

  it('lanza 404 cuando la oferta no existe o es de otro usuario', async () => {
    prismaMock.jobOffer.findFirst.mockResolvedValue(null);

    await expect(service.getById('user-2', 'offer-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('actualiza una oferta propia tras validar la pertenencia', async () => {
    prismaMock.jobOffer.findFirst.mockResolvedValue({ id: 'offer-1' });
    prismaMock.jobOffer.update.mockResolvedValue({ id: 'offer-1' });
    const dto = new JobOfferDto();
    dto.title = 'Nuevo título';

    await service.update('user-1', 'offer-1', dto);

    expect(prismaMock.jobOffer.update).toHaveBeenCalledWith({
      where: { id: 'offer-1' },
      data: expect.objectContaining({
        title: 'Nuevo título',
      }) as Record<string, unknown>,
    });
  });

  it('borra una oferta propia tras validar la pertenencia', async () => {
    prismaMock.jobOffer.findFirst.mockResolvedValue({ id: 'offer-1' });
    prismaMock.jobOffer.delete.mockResolvedValue({ id: 'offer-1' });

    await service.remove('user-1', 'offer-1');

    expect(prismaMock.jobOffer.delete).toHaveBeenCalledWith({
      where: { id: 'offer-1' },
    });
  });

  it('no borra una oferta ajena', async () => {
    prismaMock.jobOffer.findFirst.mockResolvedValue(null);

    await expect(service.remove('user-2', 'offer-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prismaMock.jobOffer.delete).not.toHaveBeenCalled();
  });
});
