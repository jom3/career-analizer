import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { CvAnalysisParserService } from './../src/cv-analysis/cv-analysis-parser.service';

const parserMock = {
  review: jest.fn().mockResolvedValue({
    strengths: ['Trabaja con Node.js y PostgreSQL.'],
    suggestions: [
      { section: 'experience', action: 'Sumá métricas a tu experiencia.' },
    ],
  }),
};

interface AnalysisBody {
  score: number;
  checks: { key: string; ok: boolean }[];
  strengths: string[];
  suggestions: { section: string; action: string }[];
  aiAvailable: boolean;
  lang: string;
}

describe('CV Analysis (e2e)', () => {
  let app: INestApplication<App>;
  const email = `cv-analysis-${Date.now()}@test.dev`;
  const password = 'Password123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CvAnalysisParserService)
      .useValue(parserMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Analista', email, password })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects anonymous requests with 401', async () => {
    await request(app.getHttpServer()).get('/cv-analysis').expect(401);
  });

  it('returns a zero score for an empty profile without calling the AI', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    const response = await agent.get('/cv-analysis').expect(200);
    const body = response.body as AnalysisBody;

    expect(body.score).toBe(0);
    expect(body.checks).toHaveLength(9);
    expect(body.aiAvailable).toBe(false);
    expect(parserMock.review).not.toHaveBeenCalled();
  });

  it('scores a filled profile and includes the AI review', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    await agent
      .put('/profile')
      .send({
        headline: 'Backend Developer',
        phone: '+54 11 5555-5555',
        location: 'Buenos Aires',
        summary: 'Backend con Node.js.',
        experiences: [
          {
            company: 'Acme',
            position: 'Backend Engineer',
            location: null,
            startDate: '2020-01-01',
            endDate: null,
            current: true,
            description: 'APIs con NestJS.',
            metrics: ['Latencia -30%'],
            sortOrder: 0,
          },
        ],
        skills: ['Node.js', 'NestJS', 'PostgreSQL', 'TypeScript', 'Docker'].map(
          (name, index) => ({ name, level: 4, sortOrder: index }),
        ),
        education: [
          {
            degree: 'Ingeniería',
            institution: 'Universidad',
            field: null,
            startDate: null,
            endDate: null,
            current: false,
            description: null,
            sortOrder: 0,
          },
        ],
        certifications: [],
        projects: [
          {
            name: 'Tablero',
            role: null,
            description: 'Tablero interno.',
            url: null,
            techStack: ['Angular'],
            metrics: [],
            sortOrder: 0,
          },
        ],
        languages: [{ name: 'Inglés', level: 'B2', sortOrder: 0 }],
      })
      .expect(200);

    const response = await agent.get('/cv-analysis').expect(200);
    const body = response.body as AnalysisBody;

    expect(body.score).toBeGreaterThan(0);
    expect(body.checks).toHaveLength(9);
    expect(body.aiAvailable).toBe(true);
    expect(body.strengths.length).toBeGreaterThan(0);
    expect(body.suggestions[0]).toEqual({
      section: 'experience',
      action: 'Sumá métricas a tu experiencia.',
    });
    expect(body.lang).toBe('es');
  });

  it('degrades gracefully when the AI fails', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);
    parserMock.review.mockRejectedValueOnce(new Error('boom'));

    const response = await agent.get('/cv-analysis').expect(200);
    const body = response.body as AnalysisBody;

    expect(body.aiAvailable).toBe(false);
    expect(body.strengths).toEqual([]);
    expect(body.score).toBeGreaterThan(0);
  });
});
