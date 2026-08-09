import { Test, TestingModule } from '@nestjs/testing';
import * as mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { PrismaService } from '../prisma/prisma.service';
import { CvExportService, CvData } from './cv-export.service';

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = new PDFParse({ data: buffer });
  try {
    const result = await pdf.getText({ pageJoiner: '\n' });
    return result.text;
  } finally {
    await pdf.destroy();
  }
}

describe('CvExportService', () => {
  let service: CvExportService;
  const prismaMock = {
    user: { findUnique: jest.fn() },
  };

  const sampleData: CvData = {
    name: 'Juan Pérez',
    email: 'juan@test.dev',
    headline: 'Software Engineer',
    summary: 'Backend specialist.',
    experiences: [
      {
        company: 'Acme',
        position: 'Senior Engineer',
        startDate: new Date('2020-01-01'),
        current: true,
        description: 'Built APIs',
        metrics: ['Cut latency by 40%'],
      },
    ],
    skills: [{ name: 'TypeScript', level: 4 }],
    education: [{ degree: 'Ing', institution: 'UBA', current: false }],
    certifications: [{ name: 'AWS', issuer: 'Amazon', year: 2021 }],
    projects: [
      {
        name: 'Career Analyzer',
        role: 'Owner',
        techStack: ['NestJS', 'Angular'],
        metrics: ['10k users'],
      },
    ],
    languages: [{ name: 'Spanish', level: 'C2' }],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CvExportService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<CvExportService>(CvExportService);
  });

  describe('buildPdf', () => {
    it('generates a PDF starting with %PDF', async () => {
      const buffer = await service.buildPdf(sampleData, 'es');

      expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    });

    it('contains the profile data as selectable text', async () => {
      const buffer = await service.buildPdf(sampleData, 'es');
      const text = await extractPdfText(buffer);

      expect(text).toContain('Juan Pérez');
      expect(text).toContain('Backend specialist.');
      expect(text).toContain('Senior Engineer');
      expect(text).toContain('TypeScript');
      expect(text).toContain('Spanish (C2)');
      expect(text).not.toContain('(4/5)');
      expect(text).toContain('Cut latency by 40%');
      expect(text).toContain('10k users');
      expect(text).toContain('01/2020 — Actualidad');
    });
  });

  describe('buildDocx', () => {
    it('generates a valid DOCX (zip with PK prefix)', async () => {
      const buffer = await service.buildDocx(sampleData, 'es');

      expect(buffer.subarray(0, 2).toString()).toBe('PK');
    });

    it('contains the profile data', async () => {
      const buffer = await service.buildDocx(sampleData, 'es');
      const text = await extractDocxText(buffer);

      expect(text).toContain('Juan Pérez');
      expect(text).toContain('Backend specialist.');
      expect(text).toContain('Senior Engineer');
      expect(text).toContain('AWS — Amazon — 2021');
      expect(text).toContain('Cut latency by 40%');
      expect(text).toContain('10k users');
      expect(text).toContain('01/2020 — Actualidad');
    });
  });

  describe('empty sections', () => {
    it('omits empty sections in the DOCX', async () => {
      const data: CvData = {
        ...sampleData,
        summary: undefined,
        skills: [],
        education: [],
        certifications: [],
        projects: [],
        languages: [],
      };

      const buffer = await service.buildDocx(data, 'es');
      const text = await extractDocxText(buffer);

      expect(text).toContain('Experiencia');
      expect(text).toContain('Senior Engineer');
      expect(text).not.toContain('Resumen');
      expect(text).not.toContain('Habilidades');
      expect(text).not.toContain('Educación');
      expect(text).not.toContain('Certificaciones');
      expect(text).not.toContain('Proyectos');
      expect(text).not.toContain('Idiomas');
    });

    it('omits empty sections in the PDF', async () => {
      const data: CvData = {
        ...sampleData,
        summary: undefined,
        skills: [],
        education: [],
        certifications: [],
        projects: [],
        languages: [],
      };

      const buffer = await service.buildPdf(data, 'es');
      const text = await extractPdfText(buffer);

      expect(text).toContain('Experiencia');
      expect(text).not.toContain('Resumen');
      expect(text).not.toContain('Habilidades');
      expect(text).not.toContain('Educación');
      expect(text).not.toContain('Idiomas');
    });
  });

  describe('headings language', () => {
    it('switches section titles between es and en', async () => {
      const esBuffer = await service.buildDocx(sampleData, 'es');
      const esText = await extractDocxText(esBuffer);
      const enBuffer = await service.buildDocx(sampleData, 'en');
      const enText = await extractDocxText(enBuffer);

      expect(esText).toContain('Resumen');
      expect(enText).toContain('Summary');
      expect(esText).toContain('Experiencia');
      expect(enText).toContain('Experience');
      expect(esText).toContain('Habilidades');
      expect(enText).toContain('Skills');
      expect(esText).toContain('Educación');
      expect(enText).toContain('Education');
      expect(esText).toContain('Certificaciones');
      expect(enText).toContain('Certifications');
      expect(esText).toContain('Proyectos');
      expect(enText).toContain('Projects');
      expect(esText).toContain('Idiomas');
      expect(enText).toContain('Languages');
    });
  });

  describe('skills, dates and metrics', () => {
    it('renders skills without level and dates with current in es and en', async () => {
      const esBuffer = await service.buildPdf(sampleData, 'es');
      const esText = await extractPdfText(esBuffer);
      const enBuffer = await service.buildPdf(sampleData, 'en');
      const enText = await extractPdfText(enBuffer);

      expect(esText).toContain('01/2020 — Actualidad');
      expect(esText).not.toContain('(4/5)');
      expect(enText).toContain('01/2020 — Present');
      expect(enText).not.toContain('(4/5)');
    });

    it('renders non-current ranges as MM/YYYY — MM/YYYY', async () => {
      const data: CvData = {
        ...sampleData,
        experiences: [
          {
            company: 'Acme',
            position: 'Engineer',
            startDate: new Date('2018-03-15'),
            endDate: new Date('2020-11-30'),
            current: false,
          },
        ],
      };

      const buffer = await service.buildPdf(data, 'es');
      const text = await extractPdfText(buffer);

      expect(text).toContain('03/2018 — 11/2020');
    });

    it('omits the metrics bullets when metrics is absent or empty', async () => {
      const data: CvData = {
        ...sampleData,
        experiences: [
          {
            company: 'Acme',
            position: 'Engineer',
            current: true,
            metrics: [],
          },
        ],
        projects: [
          { name: 'Project X', techStack: [], metrics: [] },
          { name: 'Project Y', techStack: [] },
        ],
      };

      const buffer = await service.buildPdf(data, 'es');
      const text = await extractPdfText(buffer);

      expect(text).not.toContain('•');
    });

    it('preserves line breaks in multiline descriptions', async () => {
      const data: CvData = {
        ...sampleData,
        experiences: [
          {
            company: 'Acme',
            position: 'Engineer',
            current: true,
            description: 'Primera línea.\nSegunda línea.\nTercera línea.',
          },
        ],
      };

      const pdfBuffer = await service.buildPdf(data, 'es');
      const pdfText = await extractPdfText(pdfBuffer);
      expect(pdfText).toContain('Primera línea.');
      expect(pdfText).toContain('Segunda línea.');
      expect(pdfText).toContain('Tercera línea.');
      expect(pdfText).toMatch(
        /Primera línea\.\s*\n\s*Segunda línea\.\s*\n\s*Tercera línea\./,
      );

      const docxBuffer = await service.buildDocx(data, 'es');
      const docxText = await extractDocxText(docxBuffer);
      expect(docxText).toContain('Primera línea.');
      expect(docxText).toContain('Segunda línea.');
      expect(docxText).toContain('Tercera línea.');
      expect(docxText).toMatch(
        /Primera línea\.\s*\n\s*Segunda línea\.\s*\n\s*Tercera línea\./,
      );
    });

    it('renders languages with CEFR level in the DOCX', async () => {
      const buffer = await service.buildDocx(sampleData, 'en');
      const text = await extractDocxText(buffer);

      expect(text).toContain('Spanish (C2)');
      expect(text).not.toContain('(4/5)');
    });

    it('renders each skill on its own line in PDF and DOCX', async () => {
      const data: CvData = {
        ...sampleData,
        skills: [
          { name: 'TypeScript', level: 4 },
          { name: 'JavaScript', level: 5 },
          { name: 'Angular', level: 3 },
        ],
      };

      const pdfBuffer = await service.buildPdf(data, 'es');
      const pdfText = await extractPdfText(pdfBuffer);
      expect(pdfText).toMatch(/TypeScript\s*\n\s*JavaScript\s*\n\s*Angular/);

      const docxBuffer = await service.buildDocx(data, 'en');
      const docxText = await extractDocxText(docxBuffer);
      expect(docxText).toMatch(/TypeScript\s*\n\s*JavaScript\s*\n\s*Angular/);
    });
  });

  describe('loadCvData', () => {
    it('queries the profile collections ordered by sortOrder asc', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        name: 'Juan',
        email: 'juan@test.dev',
        profile: null,
      });

      await service.loadCvData('user-1');

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: {
          name: true,
          email: true,
          profile: {
            include: {
              experiences: { orderBy: { sortOrder: 'asc' } },
              skills: { orderBy: { sortOrder: 'asc' } },
              education: { orderBy: { sortOrder: 'asc' } },
              certifications: { orderBy: { sortOrder: 'asc' } },
              projects: { orderBy: { sortOrder: 'asc' } },
              languages: { orderBy: { sortOrder: 'asc' } },
            },
          },
        },
      });
    });

    it('discards incomplete items and exposes user name and email', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        name: 'Ana',
        email: 'ana@test.dev',
        profile: {
          headline: 'Designer',
          experiences: [
            { company: 'Acme', position: 'Engineer', current: true },
            { company: '', position: 'Ghost', current: false },
            { company: 'Beta', position: '', current: false },
          ],
          skills: [
            { name: '', level: 3 },
            { name: 'Figma', level: 5 },
          ],
          education: [],
          certifications: [],
          projects: [],
          languages: [],
        },
      });

      const data = await service.loadCvData('user-1');

      expect(data.name).toBe('Ana');
      expect(data.email).toBe('ana@test.dev');
      expect(data.headline).toBe('Designer');
      expect(data.experiences).toEqual([
        { company: 'Acme', position: 'Engineer', current: true },
      ]);
      expect(data.skills).toEqual([{ name: 'Figma', level: 5 }]);
    });

    it('throws UnauthorizedException when the user does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.loadCvData('missing')).rejects.toThrow(
        'User not found',
      );
    });
  });
});
