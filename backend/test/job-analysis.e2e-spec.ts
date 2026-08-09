import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { readFileSync } from 'fs';
import * as path from 'path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { JobParserService } from './../src/job-analysis/job-parser.service';
import { JobOfferDraft } from './../src/job-analysis/job-analysis.types';

const fakeDraft: JobOfferDraft = {
  title: 'Senior Software Engineer',
  company: 'Acme',
  level: 'Senior',
  responsibilities: ['Build and ship features'],
  requiredSkills: ['TypeScript', 'NestJS'],
  preferredSkills: ['Angular'],
  experienceYears: 5,
  experienceSummary: '5+ years building backend services',
  education: ['Computer Science'],
  languages: ['English'],
  keywords: ['backend', 'nodejs'],
};

describe('Job Analysis (e2e)', () => {
  let app: INestApplication<App>;
  const fixturesDir = path.join(__dirname, 'fixtures');
  const email = `job-analysis-e2e-${Date.now()}@test.dev`;
  const otherEmail = `job-analysis-other-${Date.now()}@test.dev`;
  const password = 'Password123!';
  const parserMock = {
    parseText: jest
      .fn()
      .mockResolvedValue({ draft: fakeDraft, sourceLanguage: 'en' }),
    parseImage: jest
      .fn()
      .mockResolvedValue({ draft: fakeDraft, sourceLanguage: 'en' }),
    modelName: 'test-model',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(JobParserService)
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

  it('POST /job-analysis/analyze without a session returns 401', async () => {
    await request(app.getHttpServer())
      .post('/job-analysis/analyze')
      .expect(401);
  });

  it('GET /job-analysis without a session returns 401', async () => {
    await request(app.getHttpServer()).get('/job-analysis').expect(401);
  });

  it('analyzes pasted text and returns the draft without persisting', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/register')
      .send({ name: 'Analyzer', email, password })
      .expect(201);

    const res = await agent
      .post('/job-analysis/analyze')
      .field('text', 'Senior Software Engineer at Acme.')
      .expect(200);

    const body = res.body as {
      draft: JobOfferDraft;
      sourceLanguage: string;
      inputType: string;
      rawInput: string;
    };
    expect(body.draft.title).toBe('Senior Software Engineer');
    expect(body.sourceLanguage).toBe('en');
    expect(body.inputType).toBe('TEXT');
    expect(body.rawInput).toContain('Acme');

    const history = await agent.get('/job-analysis').expect(200);
    expect(history.body).toHaveLength(0);
  });

  it('analyzes an uploaded image', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    const res = await agent
      .post('/job-analysis/analyze')
      .attach('file', readFileSync(path.join(fixturesDir, 'offer.png')), {
        filename: 'offer.png',
        contentType: 'image/png',
      })
      .expect(200);

    const body = res.body as {
      draft: JobOfferDraft;
      inputType: string;
      rawInput: string | null;
    };
    expect(body.draft.title).toBe('Senior Software Engineer');
    expect(body.inputType).toBe('IMAGE');
    expect(body.rawInput).toBeNull();
  });

  it('analyzes an uploaded PDF extracting its text first', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    const res = await agent
      .post('/job-analysis/analyze')
      .attach('file', readFileSync(path.join(fixturesDir, 'sample.pdf')), {
        filename: 'sample.pdf',
        contentType: 'application/pdf',
      })
      .expect(200);

    const body = res.body as { draft: JobOfferDraft; inputType: string };
    expect(body.draft.title).toBe('Senior Software Engineer');
    expect(body.inputType).toBe('PDF');
  });

  it('returns 400 when there is no text and no file', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    await agent.post('/job-analysis/analyze').expect(400);
  });

  it('returns 400 when text and file are sent together', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    await agent
      .post('/job-analysis/analyze')
      .field('text', 'some offer')
      .attach('file', Buffer.from('png-bytes'), {
        filename: 'offer.png',
        contentType: 'image/png',
      })
      .expect(400);
  });

  it('returns 400 for an unsupported file type', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    await agent
      .post('/job-analysis/analyze')
      .attach('file', Buffer.from('plain text'), {
        filename: 'offer.txt',
        contentType: 'text/plain',
      })
      .expect(400);
  });

  it('persists a confirmed draft and lists it in the history', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    const payload = {
      title: 'Senior Software Engineer',
      company: 'Acme',
      level: 'Senior',
      responsibilities: ['Build and ship features'],
      requiredSkills: ['TypeScript'],
      preferredSkills: ['Angular'],
      experienceYears: 5,
      experienceSummary: '5+ years building backend services',
      education: ['Computer Science'],
      languages: ['English'],
      keywords: ['backend'],
      sourceLanguage: 'en',
      inputType: 'TEXT',
      rawInput: 'Original offer text',
    };

    const created = await agent.post('/job-analysis').send(payload).expect(201);
    const offerId = (created.body as { id: string }).id;
    expect(offerId).toBeDefined();

    const list = await agent.get('/job-analysis').expect(200);
    const offers = list.body as {
      id: string;
      title: string;
      rawInput: string;
    }[];
    expect(offers).toHaveLength(1);
    expect(offers[0].id).toBe(offerId);
    expect(offers[0].title).toBe('Senior Software Engineer');
    expect(offers[0].rawInput).toBe('Original offer text');
  });

  it('rejects a draft without title with 400', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    await agent
      .post('/job-analysis')
      .send({ company: 'Acme', requiredSkills: [] })
      .expect(400);
  });

  it('rejects an invalid level with 400', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    await agent
      .post('/job-analysis')
      .send({ title: 'X', level: 'Guru' })
      .expect(400);
  });

  it('returns, updates and deletes the own offer; 404 for another user', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    const created = await agent
      .post('/job-analysis')
      .send({ title: 'Backend Engineer' })
      .expect(201);
    const offerId = (created.body as { id: string }).id;

    const got = await agent.get(`/job-analysis/${offerId}`).expect(200);
    expect((got.body as { title: string }).title).toBe('Backend Engineer');

    const updated = await agent
      .put(`/job-analysis/${offerId}`)
      .send({ title: 'Backend Engineer II' })
      .expect(200);
    expect((updated.body as { title: string }).title).toBe(
      'Backend Engineer II',
    );

    await agent.delete(`/job-analysis/${offerId}`).expect(204);
    await agent.get(`/job-analysis/${offerId}`).expect(404);

    const owner = request.agent(app.getHttpServer());
    await owner
      .post('/auth/register')
      .send({ name: 'Other', email: otherEmail, password })
      .expect(201);
    const owned = await owner
      .post('/job-analysis')
      .send({ title: 'Owner Offer' })
      .expect(201);
    const ownedId = (owned.body as { id: string }).id;

    await agent.get(`/job-analysis/${ownedId}`).expect(404);
    await agent
      .put(`/job-analysis/${ownedId}`)
      .send({ title: 'x' })
      .expect(404);
    await agent.delete(`/job-analysis/${ownedId}`).expect(404);
  });
});
