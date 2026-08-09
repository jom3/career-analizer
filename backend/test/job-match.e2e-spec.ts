import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { JobOfferDraft } from './../src/job-analysis/job-analysis.types';
import { MatchAnalysis } from './../src/job-match/job-match-parser.service';
import { JobMatchParserService } from './../src/job-match/job-match-parser.service';

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

const fakeAnalysis: MatchAnalysis = {
  overallScore: 82,
  overallJustification: 'Buen encaje con el stack requerido.',
  dimensions: [
    { key: 'skills', score: 90, justification: 'Cubre el stack principal.' },
    { key: 'experience', score: 70, justification: 'Experiencia relevante.' },
    {
      key: 'education',
      score: null,
      justification: 'Sin datos de educación en el perfil.',
    },
    { key: 'languages', score: 80, justification: 'Inglés presente.' },
  ],
  gaps: [
    { name: 'TypeScript', status: 'HAVE', source: 'REQUIRED' },
    {
      name: 'NestJS',
      status: 'MISSING',
      source: 'REQUIRED',
      note: 'No hay evidencia en el perfil.',
    },
  ],
  recommendations: [
    {
      type: 'SKILL',
      target: 'NestJS',
      suggestion: 'Sumá un proyecto backend con NestJS al perfil.',
    },
    {
      type: 'PROFILE',
      target: 'summary',
      suggestion: 'Completá el resumen profesional.',
    },
  ],
};

describe('Job Match (e2e)', () => {
  let app: INestApplication<App>;
  const email = `job-match-e2e-${Date.now()}@test.dev`;
  const otherEmail = `job-match-other-${Date.now()}@test.dev`;
  const password = 'Password123!';
  const parserMock = {
    match: jest.fn().mockResolvedValue(fakeAnalysis),
    modelName: 'test-model',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(JobMatchParserService)
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

  it('POST /job-match without a session returns 401', async () => {
    await request(app.getHttpServer()).post('/job-match').send({}).expect(401);
  });

  it('GET /job-match without a session returns 401', async () => {
    await request(app.getHttpServer()).get('/job-match').expect(401);
  });

  it('rejects a request with neither jobOfferId nor offer with 400', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/register')
      .send({ name: 'Matcher', email, password })
      .expect(201);

    await agent.post('/job-match').send({}).expect(400);
  });

  it('rejects a request with both jobOfferId and offer with 400', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    await agent
      .post('/job-match')
      .send({ jobOfferId: 'some-id', offer: { title: 'X' } })
      .expect(400);
  });

  it('creates a match from an unrouted offer, persists it and lists it', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    const created = await agent
      .post('/job-match')
      .send({ offer: fakeDraft, lang: 'es' })
      .expect(201);

    const body = created.body as { id: string; overallScore: number };
    expect(body.id).toBeDefined();
    expect(body.overallScore).toBe(82);

    const list = await agent.get('/job-match').expect(200);
    const matches = list.body as { id: string; jobOfferId: string | null }[];
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe(body.id);
    expect(matches[0].jobOfferId).toBeNull();
  });

  it('returns 404 when the jobOfferId belongs to another user', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    const owner = request.agent(app.getHttpServer());
    await owner
      .post('/auth/register')
      .send({ name: 'Other', email: otherEmail, password })
      .expect(201);
    const ownedOffer = await owner
      .post('/job-analysis')
      .send({ title: 'Owner Offer' })
      .expect(201);
    const ownedId = (ownedOffer.body as { id: string }).id;

    await agent.post('/job-match').send({ jobOfferId: ownedId }).expect(404);
  });

  it('creates a match linked to a persisted offer when jobOfferId is provided', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    const offer = await agent
      .post('/job-analysis')
      .send({
        title: 'Frontend Engineer',
        requiredSkills: ['Angular'],
        rawInput: 'Frontend offer',
      })
      .expect(201);
    const offerId = (offer.body as { id: string }).id;

    const created = await agent
      .post('/job-match')
      .send({ jobOfferId: offerId })
      .expect(201);
    const match = created.body as { jobOfferId: string | null };
    expect(match.jobOfferId).toBe(offerId);
  });

  it('returns, recomputes and deletes the own match; 404 for another user', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    const created = await agent
      .post('/job-match')
      .send({ offer: { title: 'Backend Engineer' } })
      .expect(201);
    const matchId = (created.body as { id: string }).id;

    const got = await agent.get(`/job-match/${matchId}`).expect(200);
    expect((got.body as { overallScore: number }).overallScore).toBe(82);

    const recomputed = await agent
      .post(`/job-match/${matchId}/recompute`)
      .expect(201);
    expect((recomputed.body as { id: string }).id).toBe(matchId);

    await agent.delete(`/job-match/${matchId}`).expect(204);
    await agent.get(`/job-match/${matchId}`).expect(404);

    const owner = request.agent(app.getHttpServer());
    await owner
      .post('/auth/login')
      .send({ email: otherEmail, password })
      .expect(201);
    const ownedOffer = await owner
      .post('/job-analysis')
      .send({ title: 'Owner Offer' })
      .expect(201);
    const ownedOfferId = (ownedOffer.body as { id: string }).id;
    const ownedMatch = await owner
      .post('/job-match')
      .send({ jobOfferId: ownedOfferId })
      .expect(201);
    const ownedMatchId = (ownedMatch.body as { id: string }).id;

    await agent.get(`/job-match/${ownedMatchId}`).expect(404);
    await agent.post(`/job-match/${ownedMatchId}/recompute`).expect(404);
    await agent.delete(`/job-match/${ownedMatchId}`).expect(404);
  });

  it('deleting a match does not delete the linked offer', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    const offer = await agent
      .post('/job-analysis')
      .send({ title: 'Kept Offer' })
      .expect(201);
    const offerId = (offer.body as { id: string }).id;

    const created = await agent
      .post('/job-match')
      .send({ jobOfferId: offerId })
      .expect(201);
    const matchId = (created.body as { id: string }).id;

    await agent.delete(`/job-match/${matchId}`).expect(204);
    const after = await agent.get(`/job-analysis/${offerId}`).expect(200);
    expect((after.body as { title: string }).title).toBe('Kept Offer');
  });
});
