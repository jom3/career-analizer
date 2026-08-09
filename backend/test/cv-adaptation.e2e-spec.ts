import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import * as mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { CvAdaptationParserService } from './../src/cv-adaptation/cv-adaptation-parser.service';

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

const parserMock = {
  adapt: jest.fn().mockResolvedValue({
    experienceDescriptions: [],
  }),
  modelName: 'test-model',
};

describe('CV Adaptation (e2e)', () => {
  let app: INestApplication<App>;
  const email = `cv-adap-${Date.now()}@test.dev`;
  const otherEmail = `cv-adap-other-${Date.now()}@test.dev`;
  const password = 'Password123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CvAdaptationParserService)
      .useValue(parserMock)
      .compile();

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

    const other = request.agent(app.getHttpServer());
    await other
      .post('/auth/register')
      .send({ name: 'Other', email: otherEmail, password })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  async function seedUser(): Promise<request.Agent> {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    await agent
      .put('/profile')
      .send({
        summary: 'Original summary.',
        experiences: [
          {
            company: 'Acme',
            position: 'Senior Engineer',
            startDate: '2020-01-01',
            current: true,
            description: 'Original description.',
            metrics: ['Cut latency by 40%'],
            sortOrder: 1,
          },
        ],
        skills: [
          { name: 'Angular', level: 4, sortOrder: 1 },
          { name: 'TypeScript', level: 5, sortOrder: 2 },
          { name: 'NestJS', level: 3, sortOrder: 3 },
        ],
        languages: [],
        education: [],
        certifications: [],
        projects: [],
      })
      .expect(200);

    return agent;
  }

  async function createOffer(
    agent: request.Agent,
    overrides: Record<string, unknown> = {},
  ): Promise<string> {
    const created = await agent
      .post('/job-analysis')
      .send({
        title: 'Senior Fullstack Engineer',
        company: 'TechCorp',
        requiredSkills: ['Angular', 'NestJS'],
        sourceLanguage: 'en',
        rawInput: 'Senior Fullstack Engineer in TypeScript and Angular.',
        ...overrides,
      })
      .expect(201);
    return (created.body as { id: string }).id;
  }

  it('POST/GET /cv-adaptation without a session returns 401', async () => {
    await request(app.getHttpServer())
      .post('/cv-adaptation')
      .send({})
      .expect(401);
    await request(app.getHttpServer()).get('/cv-adaptation').expect(401);
  });

  it('rejects POST without jobOfferId with 400', async () => {
    const agent = await seedUser();
    await agent.post('/cv-adaptation').send({}).expect(400);
  });

  it('creates an adapted CV prioritizing matched skills and keeping facts verbatim', async () => {
    const agent = await seedUser();
    const offerId = await createOffer(agent);

    const created = await agent
      .post('/cv-adaptation')
      .send({ jobOfferId: offerId })
      .expect(201);
    const body = created.body as {
      id: string;
      sourceLanguage: string | null;
      content: {
        summary: string;
        skills: { name: string }[];
        experiences: {
          company: string;
          position: string;
          description: string;
          metrics: string[];
        }[];
      };
    };

    expect(body.id).toBeDefined();
    expect(body.sourceLanguage).toBe('en');
    expect(body.content.summary).toEqual(
      expect.stringContaining('Senior Engineer'),
    );
    expect(body.content.summary).not.toEqual(expect.stringContaining('Python'));
    expect(body.content.skills.map((s) => s.name)).toEqual([
      'Angular',
      'NestJS',
      'TypeScript',
    ]);
    expect(body.content.experiences[0]).toEqual(
      expect.objectContaining({
        company: 'Acme',
        position: 'Senior Engineer',
        description: 'Original description.',
        metrics: ['Cut latency by 40%'],
      }) as object,
    );

    const list = await agent.get('/cv-adaptation').expect(200);
    const versions = list.body as { id: string }[];
    expect(versions.map((v) => v.id)).toContain(body.id);

    const got = await agent.get(`/cv-adaptation/${body.id}`).expect(200);
    expect((got.body as { stale: boolean }).stale).toBe(false);
  });

  it('exports the adapted CV as PDF and DOCX with the adapted content', async () => {
    const agent = await seedUser();
    const offerId = await createOffer(agent);
    const created = await agent
      .post('/cv-adaptation')
      .send({ jobOfferId: offerId })
      .expect(201);
    const versionId = (created.body as { id: string }).id;

    const pdf = await agent
      .get(`/cv-adaptation/${versionId}/export?format=pdf`)
      .buffer(true)
      .parse(asBuffer().parse)
      .expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.headers['content-disposition']).toContain(
      'filename="juan-p-rez-CV-adaptado.pdf"',
    );
    const pdfBuffer = binaryBody(pdf);
    expect(pdfBuffer.subarray(0, 5).toString()).toBe('%PDF-');
    const parsedPdf = new PDFParse({ data: Buffer.from(pdfBuffer) });
    try {
      const result = await parsedPdf.getText({ pageJoiner: '\n' });
      expect(result.text).toContain('Senior Engineer');
      expect(result.text).toContain('Angular');
      expect(result.text).toContain('NestJS');
      expect(result.text).toContain('Original description.');
      expect(result.text).toContain('Cut latency by 40%');
    } finally {
      await parsedPdf.destroy();
    }

    const docx = await agent
      .get(`/cv-adaptation/${versionId}/export?format=docx`)
      .buffer(true)
      .parse(asBuffer().parse)
      .expect(200);
    expect(docx.headers['content-type']).toContain(DOCX_MIME);
    const docxBuffer = binaryBody(docx);
    expect(docxBuffer.subarray(0, 2).toString()).toBe('PK');
    const docxResult = await mammoth.extractRawText({
      buffer: Buffer.from(docxBuffer),
    });
    expect(docxResult.value).toContain('Senior Engineer');
    expect(docxResult.value).toContain('Original description.');
  });

  it('rejects an offer and an export of another user with 404', async () => {
    const agent = await seedUser();
    await agent.post('/auth/login').send({ email, password }).expect(201);

    const owner = request.agent(app.getHttpServer());
    await owner
      .post('/auth/login')
      .send({ email: otherEmail, password })
      .expect(201);
    const ownedOffer = await owner
      .post('/job-analysis')
      .send({ title: 'Owner Offer', rawInput: 'owner offer text' })
      .expect(201);
    const ownedOfferId = (ownedOffer.body as { id: string }).id;

    await agent
      .post('/cv-adaptation')
      .send({ jobOfferId: ownedOfferId })
      .expect(404);

    const ownOfferId = await createOffer(agent);
    await agent
      .post('/cv-adaptation')
      .send({ jobOfferId: ownOfferId })
      .expect(201);

    const ownerCv = await owner
      .post('/cv-adaptation')
      .send({ jobOfferId: ownedOfferId })
      .expect(201);
    const ownerVersionId = (ownerCv.body as { id: string }).id;

    await agent.get(`/cv-adaptation/${ownerVersionId}`).expect(404);
    await agent
      .get(`/cv-adaptation/${ownerVersionId}/export?format=pdf`)
      .expect(404);
    await agent.delete(`/cv-adaptation/${ownerVersionId}`).expect(404);
  });

  it('rejects a jobMatchId belonging to another user with 404', async () => {
    const agent = await seedUser();
    const offerId = await createOffer(agent);

    const other = request.agent(app.getHttpServer());
    await other
      .post('/auth/login')
      .send({ email: otherEmail, password })
      .expect(201);
    const otherMatch = await other
      .post('/job-match')
      .send({ offer: { title: 'Other Match Offer' } })
      .expect(201);
    const otherMatchId = (otherMatch.body as { id: string }).id;

    await agent
      .post('/cv-adaptation')
      .send({ jobOfferId: offerId, jobMatchId: otherMatchId })
      .expect(404);
  });

  it('deleting a version does not delete the linked offer', async () => {
    const agent = await seedUser();
    const offerId = await createOffer(agent);
    const created = await agent
      .post('/cv-adaptation')
      .send({ jobOfferId: offerId })
      .expect(201);
    const versionId = (created.body as { id: string }).id;

    await agent.delete(`/cv-adaptation/${versionId}`).expect(204);
    await agent.get(`/cv-adaptation/${versionId}`).expect(404);

    const after = await agent.get(`/job-analysis/${offerId}`).expect(200);
    expect((after.body as { title: string }).title).toBe(
      'Senior Fullstack Engineer',
    );
  });
});
