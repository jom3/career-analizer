import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import * as mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { CoverLetterParserService } from './../src/cover-letter/cover-letter-parser.service';

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
  generate: jest.fn().mockResolvedValue({
    content:
      'Dear Mrs. López,\n\nI am very interested in the Senior Fullstack Engineer position.\n\nSincerely,',
  }),
  modelName: 'test-model',
};

describe('Cover Letter (e2e)', () => {
  let app: INestApplication<App>;
  const email = `cover-letter-${Date.now()}@test.dev`;
  const otherEmail = `cover-letter-other-${Date.now()}@test.dev`;
  const password = 'Password123!';

  const expectedContent =
    'Dear Mrs. López,\n\nI am very interested in the Senior Fullstack Engineer position.\n\nSincerely,';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CoverLetterParserService)
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
        headline: 'Software Engineer',
        summary: 'Original summary.',
        experiences: [
          {
            company: 'Acme',
            position: 'Senior Engineer',
            startDate: '2020-01-01',
            current: true,
            description: 'Built APIs with TypeScript.',
            metrics: ['Cut latency by 40%'],
            sortOrder: 1,
          },
        ],
        skills: [
          { name: 'Angular', level: 4, sortOrder: 1 },
          { name: 'TypeScript', level: 5, sortOrder: 2 },
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
        requiredSkills: ['Angular', 'TypeScript'],
        sourceLanguage: 'en',
        rawInput: 'Senior Fullstack Engineer in TypeScript and Angular.',
        ...overrides,
      })
      .expect(201);
    return (created.body as { id: string }).id;
  }

  it('POST/GET /cover-letter without a session returns 401', async () => {
    await request(app.getHttpServer())
      .post('/cover-letter')
      .send({})
      .expect(401);
    await request(app.getHttpServer()).get('/cover-letter').expect(401);
  });

  it('rejects POST /cover-letter/draft without jobOfferId with 400', async () => {
    const agent = await seedUser();
    await agent.post('/cover-letter/draft').send({}).expect(400);
  });

  it('rejects draft and create with a foreign or missing offer with 404', async () => {
    const agent = await seedUser();
    await agent
      .post('/cover-letter/draft')
      .send({ jobOfferId: 'inexistente' })
      .expect(404);
    await agent
      .post('/cover-letter')
      .send({ jobOfferId: 'inexistente', content: 'Hola' })
      .expect(404);
  });

  it('builds a draft without persisting anything', async () => {
    const agent = await seedUser();
    const offerId = await createOffer(agent);

    const before = await agent.get('/cover-letter').expect(200);
    const countBefore = (before.body as unknown[]).length;

    const draft = await agent
      .post('/cover-letter/draft')
      .set('Accept-Language', 'en')
      .send({ jobOfferId: offerId, recruiterName: 'Mrs. López' })
      .expect(200);
    const draftBody = draft.body as {
      content: string;
      sourceLanguage: string | null;
    };
    expect(draftBody.content).toBe(expectedContent);
    expect(draftBody.sourceLanguage).toBe('en');

    const after = await agent.get('/cover-letter').expect(200);
    expect((after.body as unknown[]).length).toBe(countBefore);
  });

  it('creates a letter with the edited content and lists it in the history', async () => {
    const agent = await seedUser();
    const offerId = await createOffer(agent);

    const created = await agent
      .post('/cover-letter')
      .set('Accept-Language', 'en')
      .send({
        jobOfferId: offerId,
        recruiterName: 'Mrs. López',
        note: 'Vi la vacante en LinkedIn.',
        content: 'Dear Mrs. López,\n\nNew edited content.\n\nSincerely,',
      })
      .expect(201);
    const body = created.body as {
      id: string;
      sourceLanguage: string | null;
      recruiterName: string | null;
      content: string;
      stale: boolean;
    };
    expect(body.id).toBeDefined();
    expect(body.sourceLanguage).toBe('en');
    expect(body.recruiterName).toBe('Mrs. López');
    expect(body.content).toBe(
      'Dear Mrs. López,\n\nNew edited content.\n\nSincerely,',
    );
    expect(body.stale).toBe(false);

    const list = await agent.get('/cover-letter').expect(200);
    expect((list.body as { id: string }[]).map((l) => l.id)).toContain(body.id);

    const got = await agent.get(`/cover-letter/${body.id}`).expect(200);
    expect((got.body as { stale: boolean }).stale).toBe(false);
  });

  it('rejects create without content with 400', async () => {
    const agent = await seedUser();
    const offerId = await createOffer(agent);
    await agent.post('/cover-letter').send({ jobOfferId: offerId }).expect(400);
  });

  it('exports the letter as PDF and DOCX with subject, content and signature', async () => {
    const agent = await seedUser();
    const offerId = await createOffer(agent);
    const created = await agent
      .post('/cover-letter')
      .send({
        jobOfferId: offerId,
        recruiterName: 'Mrs. López',
        content: expectedContent,
      })
      .expect(201);
    const letterId = (created.body as { id: string }).id;

    const pdf = await agent
      .get(`/cover-letter/${letterId}/export?format=pdf`)
      .buffer(true)
      .parse(asBuffer().parse)
      .expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.headers['content-disposition']).toContain(
      'filename="juan-p-rez-carta-de-motivacion.pdf"',
    );
    const pdfBuffer = binaryBody(pdf);
    expect(pdfBuffer.subarray(0, 5).toString()).toBe('%PDF-');
    const parsedPdf = new PDFParse({ data: Buffer.from(pdfBuffer) });
    try {
      const result = await parsedPdf.getText({ pageJoiner: '\n' });
      expect(result.text).toContain('Re: Senior Fullstack Engineer — TechCorp');
      expect(result.text).toContain('Dear Mrs. López');
      expect(result.text).toContain('Senior Fullstack Engineer position');
      expect(result.text).toContain(`Juan Pérez — ${email}`);
    } finally {
      await parsedPdf.destroy();
    }

    const docx = await agent
      .get(`/cover-letter/${letterId}/export?format=docx`)
      .buffer(true)
      .parse(asBuffer().parse)
      .expect(200);
    expect(docx.headers['content-type']).toContain(DOCX_MIME);
    const docxBuffer = binaryBody(docx);
    expect(docxBuffer.subarray(0, 2).toString()).toBe('PK');
    const docxResult = await mammoth.extractRawText({
      buffer: Buffer.from(docxBuffer),
    });
    expect(docxResult.value).toContain(
      'Re: Senior Fullstack Engineer — TechCorp',
    );
    expect(docxResult.value).toContain('Dear Mrs. López');
    expect(docxResult.value).toContain(`Juan Pérez — ${email}`);
  });

  it('rejects an invalid export format with 400', async () => {
    const agent = await seedUser();
    const offerId = await createOffer(agent);
    const created = await agent
      .post('/cover-letter')
      .send({ jobOfferId: offerId, content: expectedContent })
      .expect(201);
    const letterId = (created.body as { id: string }).id;
    await agent.get(`/cover-letter/${letterId}/export?format=png`).expect(400);
  });

  it('rejects reading, exporting and deleting another user letter with 404', async () => {
    const owner = request.agent(app.getHttpServer());
    await owner
      .post('/auth/login')
      .send({ email: otherEmail, password })
      .expect(201);
    const ownedOfferId = await createOffer(owner);
    const ownedLetter = await owner
      .post('/cover-letter')
      .send({
        jobOfferId: ownedOfferId,
        content: 'Owner letter content.',
      })
      .expect(201);
    const ownedLetterId = (ownedLetter.body as { id: string }).id;

    const agent = await seedUser();
    await agent.get(`/cover-letter/${ownedLetterId}`).expect(404);
    await agent
      .get(`/cover-letter/${ownedLetterId}/export?format=pdf`)
      .expect(404);
    await agent.delete(`/cover-letter/${ownedLetterId}`).expect(404);
  });

  it('deleting a letter does not delete the linked offer', async () => {
    const agent = await seedUser();
    const offerId = await createOffer(agent);
    const created = await agent
      .post('/cover-letter')
      .send({ jobOfferId: offerId, content: expectedContent })
      .expect(201);
    const letterId = (created.body as { id: string }).id;

    await agent.delete(`/cover-letter/${letterId}`).expect(204);
    await agent.get(`/cover-letter/${letterId}`).expect(404);

    const after = await agent.get(`/job-analysis/${offerId}`).expect(200);
    expect((after.body as { title: string }).title).toBe(
      'Senior Fullstack Engineer',
    );
  });
});
