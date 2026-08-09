import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { readFileSync } from 'fs';
import * as path from 'path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { CvParserService } from './../src/cv-import/cv-parser.service';
import { CvDraft } from './../src/cv-import/cv-import.types';

const fakeDraft: CvDraft = {
  headline: 'Software Engineer',
  phone: null,
  location: 'Buenos Aires',
  website: null,
  linkedin: null,
  summary:
    'Experienced software engineer skilled in TypeScript, NestJS and Angular.',
  experiences: [
    {
      company: 'Acme',
      position: 'Senior Developer',
      location: null,
      startDate: '2020-01-01',
      endDate: null,
      current: true,
      description: null,
      source: 'CV_IMPORT',
      sortOrder: 0,
    },
  ],
  skills: [{ name: 'TypeScript', level: 4, source: 'CV_IMPORT', sortOrder: 0 }],
  education: [],
  certifications: [],
  projects: [],
  languages: [],
};

describe('CV Import (e2e)', () => {
  let app: INestApplication<App>;
  const fixturesDir = path.join(__dirname, 'fixtures');
  const email = `cv-import-e2e-${Date.now()}@test.dev`;
  const otherEmail = `cv-import-other-${Date.now()}@test.dev`;
  const password = 'Password123!';
  const parserMock = {
    parse: jest
      .fn()
      .mockResolvedValue({ draft: fakeDraft, sourceLanguage: 'en' }),
    modelName: 'test-model',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CvParserService)
      .useValue(parserMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /cv-import without a session returns 401', async () => {
    await request(app.getHttpServer()).post('/cv-import').expect(401);
  });

  it('GET /cv-import/:id without a session returns 401', async () => {
    await request(app.getHttpServer()).get('/cv-import/any').expect(401);
  });

  it('uploads a valid PDF and returns draft + ATS report', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/register')
      .send({ name: 'CV', email, password })
      .expect(201);

    const res = await agent
      .post('/cv-import')
      .attach('file', readFileSync(path.join(fixturesDir, 'sample.pdf')), {
        filename: 'sample.pdf',
        contentType: 'application/pdf',
      })
      .expect(200);

    const body = res.body as {
      documentId: string;
      draft: CvDraft;
      sourceLanguage: string;
      atsReport: { key: string; ok: boolean }[];
    };
    expect(body.documentId).toBeDefined();
    expect(body.draft.headline).toBe('Software Engineer');
    expect(body.sourceLanguage).toBe('en');
    expect(body.atsReport).toHaveLength(7);
    expect(body.atsReport.map((item) => item.key)).toEqual([
      'contact',
      'headline',
      'summary',
      'experience',
      'skills',
      'education',
      'languages',
    ]);
  });

  it('uploads a valid DOCX and returns 200', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    await agent
      .post('/cv-import')
      .attach('file', readFileSync(path.join(fixturesDir, 'sample.docx')), {
        filename: 'sample.docx',
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
      .expect(200);
  });

  it('stores a ligature-bearing PDF with a clean extractedText', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    const upload = await agent
      .post('/cv-import')
      .attach('file', readFileSync(path.join(fixturesDir, 'ligatures.pdf')), {
        filename: 'ligatures.pdf',
        contentType: 'application/pdf',
      })
      .expect(200);
    const documentId = (upload.body as { documentId: string }).documentId;

    const res = await agent.get(`/cv-import/${documentId}`).expect(200);
    const body = res.body as { extractedText: string };
    expect(body.extractedText).toBeDefined();
    expect(body.extractedText).not.toMatch(/[\uFB00-\uFB06\u00A0\u2007\u202F]/);
    expect(body.extractedText).toContain('file');
    expect(body.extractedText).toContain('office');
    expect(body.extractedText).toContain('start');
  });

  it('rejects an unsupported mime type with 400', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    await agent
      .post('/cv-import')
      .attach('file', Buffer.from('plain text'), {
        filename: 'cv.txt',
        contentType: 'text/plain',
      })
      .expect(400);
  });

  it('returns 422 when the PDF has no text layer', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    await agent
      .post('/cv-import')
      .attach('file', readFileSync(path.join(fixturesDir, 'scanned.pdf')), {
        filename: 'scanned.pdf',
        contentType: 'application/pdf',
      })
      .expect(422);
  });

  it('GET /cv-import/:id returns the own document with its draft', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    const upload = await agent
      .post('/cv-import')
      .attach('file', readFileSync(path.join(fixturesDir, 'sample.pdf')), {
        filename: 'sample.pdf',
        contentType: 'application/pdf',
      })
      .expect(200);
    const documentId = (upload.body as { documentId: string }).documentId;

    const res = await agent.get(`/cv-import/${documentId}`).expect(200);
    const body = res.body as {
      id: string;
      originalName: string;
      draftJson: CvDraft;
    };
    expect(body.id).toBe(documentId);
    expect(body.originalName).toBe('sample.pdf');
    expect(body.draftJson).toBeDefined();
    expect(body.draftJson.experiences[0].source).toBe('CV_IMPORT');
  });

  it('GET /cv-import/:id of another user returns 404', async () => {
    const owner = request.agent(app.getHttpServer());
    await owner
      .post('/auth/register')
      .send({ name: 'Other', email: otherEmail, password })
      .expect(201);
    const upload = await owner
      .post('/cv-import')
      .attach('file', readFileSync(path.join(fixturesDir, 'sample.pdf')), {
        filename: 'sample.pdf',
        contentType: 'application/pdf',
      })
      .expect(200);
    const documentId = (upload.body as { documentId: string }).documentId;

    const intruder = request.agent(app.getHttpServer());
    await intruder.post('/auth/login').send({ email, password }).expect(201);
    await intruder.get(`/cv-import/${documentId}`).expect(404);
  });

  it('PUT /profile persists source and GET /profile reflects it', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    const payload = {
      headline: 'Software Engineer',
      skills: [
        { name: 'TypeScript', level: 4, source: 'CV_IMPORT', sortOrder: 1 },
      ],
      experiences: [
        {
          company: 'Acme',
          position: 'Senior Developer',
          startDate: '2020-01-01',
          current: true,
          source: 'CV_IMPORT',
          sortOrder: 1,
        },
      ],
      education: [],
      certifications: [],
      projects: [],
      languages: [],
    };

    await agent.put('/profile').send(payload).expect(200);

    const res = await agent.get('/profile').expect(200);
    const body = res.body as {
      skills: { name: string; source: string }[];
      experiences: { company: string; source: string }[];
    };
    expect(body.skills[0].source).toBe('CV_IMPORT');
    expect(body.experiences[0].source).toBe('CV_IMPORT');
  });
});
