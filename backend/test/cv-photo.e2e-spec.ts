import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { readFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import * as path from 'path';
import { PDFDocument } from 'pdf-lib';
import { PDFParse } from 'pdf-parse';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

const FIXTURES = path.join(__dirname, 'fixtures');
const PNG_PHOTO = readFileSync(path.join(FIXTURES, 'offer.png'));
const PDF_DOCUMENT = readFileSync(path.join(FIXTURES, 'sample.pdf'));
const MAX_FILE_BYTES = 10 * 1024 * 1024;

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

async function pdfText(buffer: Buffer): Promise<string> {
  const pdf = new PDFParse({ data: Buffer.from(buffer) });
  try {
    return (await pdf.getText({ pageJoiner: '\n' })).text;
  } finally {
    await pdf.destroy();
  }
}

describe('CV photo and documented CV (e2e)', () => {
  let app: INestApplication<App>;
  const email = `cv-photo-e2e-${Date.now()}@test.dev`;
  const password = 'Password123!';
  let agent: request.Agent;
  let educationId: string;

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

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Ana Gómez', email, password })
      .expect(201);

    agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    const profile = await agent
      .put('/profile')
      .send({
        headline: 'Ingeniera de Software',
        summary: 'Desarrolladora backend.',
        experiences: [],
        skills: [{ name: 'TypeScript', level: 4, sortOrder: 1 }],
        languages: [{ name: 'Inglés', level: 'B2', sortOrder: 1 }],
        education: [
          {
            degree: 'Licenciatura en Informática',
            institution: 'Universidad Demo',
            current: false,
            startDate: '2014-01-01',
            endDate: '2018-01-01',
            showInCompactCv: true,
            showInDocumentedCv: true,
            sortOrder: 1,
          },
        ],
        certifications: [
          {
            name: 'Curso corto',
            issuer: 'Plataforma',
            showInCompactCv: false,
            showInDocumentedCv: true,
            sortOrder: 1,
          },
          {
            name: 'Curso largo',
            issuer: 'Plataforma',
            showInCompactCv: true,
            showInDocumentedCv: true,
            sortOrder: 2,
          },
        ],
        projects: [],
      })
      .expect(200);
    const saved = profile.body as { education: { id: string }[] };
    educationId = saved.education[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated access to the new endpoints', async () => {
    const anonymous = request(app.getHttpServer());
    await anonymous.get('/profile/photo').expect(401);
    await anonymous.get('/cv-photo?format=pdf').expect(401);
    await anonymous.get('/cv-documented?format=pdf').expect(401);
  });

  it('rejects a photo that is not JPG or PNG', async () => {
    await agent
      .put('/profile/photo')
      .attach('file', PDF_DOCUMENT, 'foto.pdf')
      .expect(400);
  });

  it('rejects a photo larger than 10 MB', async () => {
    const oversized = Buffer.concat([
      PNG_PHOTO,
      Buffer.alloc(MAX_FILE_BYTES + 1 - PNG_PHOTO.length),
    ]);
    await agent
      .put('/profile/photo')
      .attach('file', oversized, 'grande.png')
      .expect(413);
  });

  it('stores a PNG photo and serves it back to its owner', async () => {
    const uploaded = await agent
      .put('/profile/photo')
      .attach('file', PNG_PHOTO, 'foto.png')
      .expect(200);
    expect((uploaded.body as { photoMimeType: string }).photoMimeType).toBe(
      'image/png',
    );

    const res = await agent
      .get('/profile/photo')
      .buffer(true)
      .parse(asBuffer().parse)
      .expect(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.from(res.body as Buffer).equals(PNG_PHOTO)).toBe(true);
  });

  it('renders the compact CV with the photo and only compact items', async () => {
    const res = await agent
      .get('/cv-photo?format=pdf&lang=es')
      .buffer(true)
      .parse(asBuffer().parse)
      .expect(200);

    const body = res.body as Buffer;
    expect(body.subarray(0, 5).toString()).toBe('%PDF-');
    const text = await pdfText(body);
    expect(text).toContain('Ana Gómez');
    expect(text).toContain('Curso largo');
    expect(text).not.toContain('Curso corto');
  });

  it('renders the compact CV as DOCX', async () => {
    const res = await agent
      .get('/cv-photo?format=docx')
      .buffer(true)
      .parse(asBuffer().parse)
      .expect(200);
    expect((res.body as Buffer).subarray(0, 2).toString()).toBe('PK');
  });

  it('attaches a document to an education item and removes it', async () => {
    const uploaded = await agent
      .put(`/profile/education/${educationId}/document`)
      .attach('file', PDF_DOCUMENT, 'titulo.pdf')
      .expect(200);
    expect((uploaded.body as { documentName: string }).documentName).toBe(
      'titulo.pdf',
    );

    await agent
      .get(`/profile/education/${educationId}/document`)
      .buffer(true)
      .parse(asBuffer().parse)
      .expect(200);

    await agent
      .delete(`/profile/education/${educationId}/document`)
      .expect(204);
    await agent.get(`/profile/education/${educationId}/document`).expect(404);
  });

  it('still downloads the documented CV when an attached file was deleted from disk', async () => {
    await agent
      .put(`/profile/education/${educationId}/document`)
      .attach('file', PDF_DOCUMENT, 'titulo.pdf')
      .expect(200);

    // Simula unm volumen o carpeta de uploads que perdió el archivo: el
    // endpoint debe seguir entregando el CV, omitiendo ese anexo.
    const downloadsDir = path.join(process.cwd(), 'uploads', 'profile');
    const stored = readdirSync(downloadsDir);
    const latest = stored
      .map((name) => ({
        name,
        time: statSync(path.join(downloadsDir, name)).mtimeMs,
      }))
      .sort((a, b) => b.time - a.time)[0].name;
    unlinkSync(path.join(downloadsDir, latest));

    const res = await agent
      .get('/cv-documented?format=pdf')
      .buffer(true)
      .parse(asBuffer().parse)
      .expect(200);
    expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');

    await agent.get(`/profile/education/${educationId}/document`).expect(404);
  });

  it('returns 404 when the item does not belong to the user', async () => {
    await agent
      .put('/profile/certifications/missing-item/document')
      .attach('file', PDF_DOCUMENT, 'curso.pdf')
      .expect(404);
  });

  it('builds the documented CV with the attachments of documented items', async () => {
    await agent
      .put(`/profile/education/${educationId}/document`)
      .attach('file', PDF_DOCUMENT, 'titulo.pdf')
      .expect(200);

    const res = await agent
      .get('/cv-documented?format=pdf&lang=es')
      .buffer(true)
      .parse(asBuffer().parse)
      .expect(200);

    const body = res.body as Buffer;
    expect(body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(res.headers['content-disposition']).toContain('-CV-documentado.pdf');

    const output = await PDFDocument.load(body);
    const compact = await agent
      .get('/cv-photo?format=pdf')
      .buffer(true)
      .parse(asBuffer().parse)
      .expect(200);
    const compactPages = (
      await PDFDocument.load(compact.body as Buffer)
    ).getPageCount();
    expect(output.getPageCount()).toBeGreaterThan(compactPages);

    const text = await pdfText(body);
    expect(text).toContain('Curso corto');
    expect(text).toContain('Certificados y títulos');
  });

  it('builds the documented CV as DOCX', async () => {
    const res = await agent
      .get('/cv-documented?format=docx')
      .buffer(true)
      .parse(asBuffer().parse)
      .expect(200);
    expect((res.body as Buffer).subarray(0, 2).toString()).toBe('PK');
  });

  it('keeps the ATS CV free of items hidden from the compact CV', async () => {
    const res = await agent
      .get('/cv-export?format=pdf')
      .buffer(true)
      .parse(asBuffer().parse)
      .expect(200);
    const text = await pdfText(res.body as Buffer);
    expect(text).toContain('Curso largo');
    expect(text).not.toContain('Curso corto');
  });

  it('rejects an invalid format on the documented CV', async () => {
    await agent.get('/cv-documented?format=png').expect(400);
  });
});
