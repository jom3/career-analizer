import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { ProfileTranslatorService } from './../src/profile/profile-translator.service';

const translatorMock = {
  translate: jest.fn(),
  modelName: 'test-model',
};

describe('Profile (e2e)', () => {
  let app: INestApplication<App>;
  const email = `profile-e2e-${Date.now()}@test.dev`;
  const password = 'Password123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ProfileTranslatorService)
      .useValue(translatorMock)
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

  it('GET /profile without a session returns 401', async () => {
    await request(app.getHttpServer()).get('/profile').expect(401);
  });

  it('registering creates an empty profile and GET returns it', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/register')
      .send({ name: 'Profile E2E', email, password })
      .expect(201);

    const res = await agent.get('/profile').expect(200);
    const body = res.body as {
      headline: null;
      experiences: unknown[];
      skills: unknown[];
      education: unknown[];
      certifications: unknown[];
      projects: unknown[];
      languages: unknown[];
    };
    expect(body.headline).toBeNull();
    expect(body.experiences).toEqual([]);
    expect(body.skills).toEqual([]);
    expect(body.education).toEqual([]);
    expect(body.certifications).toEqual([]);
    expect(body.projects).toEqual([]);
    expect(body.languages).toEqual([]);
  });

  it('PUT /profile stores the sections and GET reflects them', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    const payload = {
      headline: 'Software Engineer',
      summary: 'Backend specialist.',
      experiences: [
        {
          company: 'Acme',
          position: 'Senior Engineer',
          startDate: '2020-01-01',
          current: true,
          metrics: ['Cut latency by 40%'],
          sortOrder: 1,
        },
      ],
      skills: [{ name: 'TypeScript', level: 4, sortOrder: 1 }],
      languages: [{ name: 'Spanish', level: 'C2', sortOrder: 1 }],
      projects: [
        {
          name: 'Career Analyzer',
          role: 'Owner',
          techStack: ['NestJS', 'Angular'],
          metrics: ['10k users'],
          sortOrder: 1,
        },
      ],
      education: [],
      certifications: [],
    };

    const put = await agent.put('/profile').send(payload).expect(200);
    const saved = put.body as {
      headline: string;
      experiences: { id: string; metrics: string[] }[];
      skills: { id: string; level: number }[];
      languages: { level: string }[];
      projects: { techStack: string[]; metrics: string[] }[];
    };
    expect(saved.headline).toBe('Software Engineer');
    expect(saved.experiences).toHaveLength(1);
    expect(saved.experiences[0].metrics).toEqual(['Cut latency by 40%']);
    expect(saved.skills[0].level).toBe(4);
    expect(saved.languages[0].level).toBe('C2');
    expect(saved.projects[0].techStack).toEqual(['NestJS', 'Angular']);
    expect(saved.projects[0].metrics).toEqual(['10k users']);

    const res = await agent.get('/profile').expect(200);
    const body = res.body as {
      headline: string;
      experiences: { company: string; current: boolean; metrics: string[] }[];
      projects: { metrics: string[] }[];
      skills: unknown[];
    };
    expect(body.headline).toBe('Software Engineer');
    expect(body.experiences[0]).toMatchObject({
      company: 'Acme',
      current: true,
      metrics: ['Cut latency by 40%'],
    });
    expect(body.projects[0].metrics).toEqual(['10k users']);
    expect(body.skills).toHaveLength(1);
  });

  it('PUT replaces collections, keeps owned ids and deletes removed items', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    const first = await agent
      .put('/profile')
      .send({
        experiences: [
          { company: 'Acme', position: 'A', current: false, sortOrder: 1 },
          { company: 'Beta', position: 'B', current: false, sortOrder: 2 },
        ],
        skills: [],
        education: [],
        certifications: [],
        projects: [],
        languages: [],
      })
      .expect(200);
    const firstBody = first.body as {
      experiences: { id: string; company: string }[];
    };
    const keptId = firstBody.experiences.find(
      (item) => item.company === 'Acme',
    )!.id;

    await agent
      .put('/profile')
      .send({
        experiences: [
          {
            id: keptId,
            company: 'Acme 2',
            position: 'A2',
            current: true,
            sortOrder: 1,
          },
          { company: 'Gamma', position: 'C', current: false, sortOrder: 2 },
        ],
        skills: [],
        education: [],
        certifications: [],
        projects: [],
        languages: [],
      })
      .expect(200);

    const res = await agent.get('/profile').expect(200);
    const body = res.body as { experiences: { id: string; company: string }[] };
    expect(body.experiences).toHaveLength(2);
    expect(body.experiences.some((item) => item.id === keptId)).toBe(true);
    expect(body.experiences.some((item) => item.company === 'Beta')).toBe(
      false,
    );
    expect(body.experiences.some((item) => item.company === 'Acme 2')).toBe(
      true,
    );
    expect(body.experiences.some((item) => item.company === 'Gamma')).toBe(
      true,
    );
  });

  it('PUT with more than 5 metrics on an item returns 400', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    await agent
      .put('/profile')
      .send({
        experiences: [
          {
            company: 'Acme',
            position: 'Engineer',
            current: false,
            metrics: ['1', '2', '3', '4', '5', '6'],
            sortOrder: 1,
          },
        ],
        skills: [],
        education: [],
        certifications: [],
        projects: [],
        languages: [],
      })
      .expect(400);
  });

  it('PUT with an invalid DTO returns 400', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    await agent
      .put('/profile')
      .send({
        skills: [{ name: 'X', level: 6, sortOrder: 1 }],
        experiences: [],
        education: [],
        certifications: [],
        projects: [],
        languages: [],
      })
      .expect(400);

    await agent
      .put('/profile')
      .send({
        languages: [{ name: 'Spanish', level: 'D3', sortOrder: 1 }],
        experiences: [],
        skills: [],
        education: [],
        certifications: [],
        projects: [],
      })
      .expect(400);
  });

  it('POST /profile/translate returns the profile with the target language filled without persisting', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    const put = await agent
      .put('/profile')
      .send({
        headline: 'Ingeniero de software sénior',
        summary: 'Especialista en backends ágiles.',
        experiences: [
          {
            company: 'Acme',
            position: 'Ingeniero backend sénior',
            startDate: '2020-01-01',
            current: true,
            metrics: ['Reduje la latencia un 40%'],
            sortOrder: 1,
          },
        ],
        skills: [],
        education: [],
        certifications: [],
        projects: [],
        languages: [],
      })
      .expect(200);
    const putBody = put.body as { experiences: { id: string }[] };
    const expId = putBody.experiences[0].id;

    translatorMock.translate.mockResolvedValue({
      profile: {
        headline: 'Senior Software Engineer',
        location: null,
        summary: 'Backend specialist.',
      },
      experiences: [
        {
          id: expId,
          position: 'Backend Engineer',
          location: null,
          description: null,
          metrics: ['Reduced latency by 40%'],
        },
      ],
      education: [],
      certifications: [],
      projects: [],
      languages: [],
    });

    const res = await agent
      .post('/profile/translate')
      .send({ lang: 'en' })
      .expect(200);
    const body = res.body as {
      headline: string;
      headlineEs: string | null;
      headlineEn: string | null;
      experiences: { id: string; positionEn: string | null }[];
    };
    expect(body.headline).toBe('Ingeniero de software sénior');
    expect(body.headlineEs).toBe('Ingeniero de software sénior');
    expect(body.headlineEn).toBe('Senior Software Engineer');
    expect(body.experiences[0].positionEn).toBe('Backend Engineer');

    const after = await agent.get('/profile').expect(200);
    const afterBody = after.body as { headlineEn: string | null };
    expect(afterBody.headlineEn).toBeNull();
  });

  it('POST /profile/translate with an invalid lang returns 400', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    await agent.post('/profile/translate').send({ lang: 'fr' }).expect(400);
  });
});
