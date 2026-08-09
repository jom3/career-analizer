import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import * as mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function asBuffer(): {
  parse: (res: unknown, cb: (e: Error | null, b?: Buffer) => void) => void;
} {
  return {
    parse: (res, callback) => {
      const chunks: Buffer[] = [];
      (res as NodeJS.ReadableStream).on('data', (chunk: Buffer) =>
        chunks.push(chunk),
      );
      (res as NodeJS.ReadableStream).on('end', () =>
        callback(null, Buffer.concat(chunks)),
      );
    },
  };
}

function binaryBody(res: { body: unknown }): Buffer {
  return res.body as Buffer;
}

describe('CV Export (e2e)', () => {
  let app: INestApplication<App>;
  const email = `cv-export-e2e-${Date.now()}@test.dev`;
  const password = 'Password123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    const registrar = request.agent(app.getHttpServer());
    await registrar
      .post('/auth/register')
      .send({ name: 'Juan Pérez', email, password })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  async function seedProfile(): Promise<request.Agent> {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    await agent
      .put('/profile')
      .send({
        headline: 'Software Engineer',
        summary: 'Backend specialist in TypeScript and NestJS.',
        experiences: [
          {
            company: 'Acme',
            position: 'Senior Engineer',
            startDate: '2020-01-01',
            current: true,
            description: 'Built the careers API.',
            sortOrder: 1,
          },
        ],
        skills: [{ name: 'TypeScript', level: 4, sortOrder: 1 }],
        languages: [{ name: 'Spanish', level: 'C2', sortOrder: 1 }],
        education: [],
        certifications: [],
        projects: [],
      })
      .expect(200);

    return agent;
  }

  it('GET /cv-export without a session returns 401', async () => {
    await request(app.getHttpServer()).get('/cv-export?format=pdf').expect(401);
  });

  it('GET /cv-export with an invalid format returns 400', async () => {
    const agent = await seedProfile();
    await agent.get('/cv-export?format=png').expect(400);
  });

  it('GET /cv-export with an invalid lang returns 400', async () => {
    const agent = await seedProfile();
    await agent.get('/cv-export?format=pdf&lang=fr').expect(400);
  });

  it('GET /cv-export?format=pdf returns a PDF with the profile data', async () => {
    const agent = await seedProfile();

    const res = await agent
      .get('/cv-export?format=pdf')
      .buffer(true)
      .parse(asBuffer().parse)
      .expect(200);

    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain(
      'filename="juan-p-rez-CV.pdf"',
    );
    const pdfBuffer = binaryBody(res);
    expect(pdfBuffer.subarray(0, 5).toString()).toBe('%PDF-');

    const pdf = new PDFParse({ data: Buffer.from(pdfBuffer) });
    try {
      const result = await pdf.getText({ pageJoiner: '\n' });
      expect(result.text).toContain('Juan Pérez');
      expect(result.text).toContain(
        'Backend specialist in TypeScript and NestJS.',
      );
      expect(result.text).toContain('Senior Engineer');
      expect(result.text).toContain('TypeScript (4/5)');
      expect(result.text).toContain('Spanish (C2)');
    } finally {
      await pdf.destroy();
    }
  });

  it('GET /cv-export?format=docx returns a DOCX with the profile data', async () => {
    const agent = await seedProfile();

    const res = await agent
      .get('/cv-export?format=docx')
      .buffer(true)
      .parse(asBuffer().parse)
      .expect(200);

    expect(res.headers['content-type']).toContain(DOCX_MIME);
    expect(res.headers['content-disposition']).toContain(
      'filename="juan-p-rez-CV.docx"',
    );
    const docxBuffer = binaryBody(res);
    expect(docxBuffer.subarray(0, 2).toString()).toBe('PK');

    const result = await mammoth.extractRawText({
      buffer: Buffer.from(docxBuffer),
    });
    expect(result.value).toContain('Juan Pérez');
    expect(result.value).toContain(
      'Backend specialist in TypeScript and NestJS.',
    );
    expect(result.value).toContain('Senior Engineer');
    expect(result.value).toContain('TypeScript (4/5)');
    expect(result.value).toContain('Spanish (C2)');
  });

  it('lang=es and lang=en change only the section titles', async () => {
    const agent = await seedProfile();

    const es = await agent
      .get('/cv-export?format=docx&lang=es')
      .buffer(true)
      .parse(asBuffer().parse)
      .expect(200);
    const esResult = await mammoth.extractRawText({
      buffer: Buffer.from(binaryBody(es)),
    });
    expect(esResult.value).toContain('Resumen');
    expect(esResult.value).toContain('Experiencia');

    const en = await agent
      .get('/cv-export?format=docx&lang=en')
      .buffer(true)
      .parse(asBuffer().parse)
      .expect(200);
    const enResult = await mammoth.extractRawText({
      buffer: Buffer.from(binaryBody(en)),
    });
    expect(enResult.value).toContain('Summary');
    expect(enResult.value).toContain('Experience');

    const esSummary = esResult.value.match(/Resumen/);
    const enSummary = enResult.value.match(/Summary/);
    expect(esSummary).not.toBeNull();
    expect(enSummary).not.toBeNull();
  });
});
