import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { readFile, unlink } from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import { AtsCheckService } from './ats-check.service';
import { CvImportService } from './cv-import.service';
import { CvParserService } from './cv-parser.service';
import { CvDraft } from './cv-import.types';
import { TextExtractorService } from './text-extractor.service';
import { Source } from '../generated/prisma/enums.js';

jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(Buffer.from('binary')),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

describe('CvImportService', () => {
  let service: CvImportService;
  let prismaMock: {
    cvDocument: { create: jest.Mock; findFirst: jest.Mock };
  };
  let textExtractorMock: { extract: jest.Mock };
  let parserMock: { parse: jest.Mock; modelName: string };
  let atsCheckMock: { check: jest.Mock };

  const draft: CvDraft = {
    headline: 'Software Engineer',
    phone: null,
    location: 'Buenos Aires',
    website: null,
    linkedin: null,
    summary: null,
    experiences: [],
    skills: [
      { name: 'TypeScript', level: 4, source: Source.CV_IMPORT, sortOrder: 0 },
    ],
    education: [],
    certifications: [],
    projects: [],
    languages: [],
  };

  const file = {
    buffer: Buffer.from('binary'),
    mimetype: 'application/pdf',
    originalname: 'cv.pdf',
    filename: '123.pdf',
    path: 'C:/uploads/123.pdf',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock = {
      cvDocument: { create: jest.fn(), findFirst: jest.fn() },
    };
    textExtractorMock = { extract: jest.fn() };
    parserMock = { parse: jest.fn(), modelName: 'test-model' };
    atsCheckMock = { check: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CvImportService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: TextExtractorService, useValue: textExtractorMock },
        { provide: CvParserService, useValue: parserMock },
        { provide: AtsCheckService, useValue: atsCheckMock },
      ],
    }).compile();

    service = module.get(CvImportService);
  });

  it('persiste el documento y devuelve el resultado del import', async () => {
    const documentRow = { id: 'doc-1' };
    textExtractorMock.extract.mockResolvedValue('texto extraido');
    parserMock.parse.mockResolvedValue({
      draft,
      sourceLanguage: 'es',
    });
    atsCheckMock.check.mockReturnValue([]);
    prismaMock.cvDocument.create.mockResolvedValue(documentRow);

    const result = await service.importCv('user-1', file);

    expect(readFile).toHaveBeenCalledWith('C:/uploads/123.pdf');
    expect(textExtractorMock.extract).toHaveBeenCalledWith(
      Buffer.from('binary'),
      'application/pdf',
    );
    expect(prismaMock.cvDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        originalName: 'cv.pdf',
        mimeType: 'application/pdf',
        extractedText: 'texto extraido',
        sourceLanguage: 'es',
        model: 'test-model',
        draftJson: draft,
      }) as Record<string, unknown>,
    });
    expect(result).toEqual({
      documentId: 'doc-1',
      draft,
      sourceLanguage: 'es',
      atsReport: [],
    });
  });

  it('borra el archivo subido si el pipeline falla', async () => {
    textExtractorMock.extract.mockRejectedValue(new Error('parse failed'));

    await expect(service.importCv('user-1', file)).rejects.toThrow(
      'parse failed',
    );
    expect(unlink).toHaveBeenCalledWith(file.path);
    expect(prismaMock.cvDocument.create).not.toHaveBeenCalled();
  });

  it('devuelve el documento propio del usuario', async () => {
    const documentRow = {
      id: 'doc-1',
      userId: 'user-1',
      draftJson: draft,
    };
    prismaMock.cvDocument.findFirst.mockResolvedValue(documentRow);

    const result = await service.getDocument('user-1', 'doc-1');

    expect(prismaMock.cvDocument.findFirst).toHaveBeenCalledWith({
      where: { id: 'doc-1', userId: 'user-1' },
    });
    expect(result).toBe(documentRow);
  });

  it('lanza 404 cuando el documento no existe o es de otro usuario', async () => {
    prismaMock.cvDocument.findFirst.mockResolvedValue(null);

    await expect(service.getDocument('user-2', 'doc-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
