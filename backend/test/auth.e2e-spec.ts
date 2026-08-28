import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { MailService } from './../src/mail/mail.service';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  const email = `e2e-${Date.now()}@test.dev`;
  const password = 'Password123!';

  const mailMock = {
    sendPasswordReset: jest.fn<Promise<void>, [string, string]>(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(mailMock)
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

  it('register creates the user, sets the HttpOnly cookie and never leaks the hash', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'E2E User', email, password })
      .expect(201);
    const body = res.body as { user: { email: string } };

    expect(res.headers['set-cookie'][0]).toMatch(/access_token=/);
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    expect(body.user).not.toHaveProperty('passwordHash');
    expect(body.user.email).toBe(email);
  });

  it('register with an existing email returns 409', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'E2E User', email, password })
      .expect(409);
  });

  it('register with an invalid body returns 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: '', email: 'not-an-email', password: 'x' })
      .expect(400);
  });

  it('me without a session returns 401', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('login with wrong credentials returns 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'WrongPassword!' })
      .expect(401);
  });

  it('login sets the session and me returns the user', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);

    const me = await agent.get('/auth/me').expect(200);
    const body = me.body as { user: { email: string } };
    expect(body.user.email).toBe(email);
  });

  it('logout clears the session', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email, password }).expect(201);
    await agent.post('/auth/logout').expect(201);

    await agent.get('/auth/me').expect(401);
  });

  describe('password reset flow', () => {
    const resetPassword = 'NewPassword123!';
    let resetToken: string;

    beforeEach(() => {
      mailMock.sendPasswordReset.mockClear();
    });

    function extractResetToken(): string {
      const [emailArg, resetUrl] = mailMock.sendPasswordReset.mock.calls[0];
      if (!emailArg || !resetUrl) {
        throw new Error('sendPasswordReset was not called');
      }
      const match = resetUrl.match(/token=([0-9a-f]+)/);
      if (!match) {
        throw new Error(`No reset token found in url: ${resetUrl}`);
      }
      return match[1];
    }

    it('forgot-password sends the reset link and responds 201 for an existing email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email })
        .expect(201);

      expect(res.body).toEqual({ ok: true });
      expect(mailMock.sendPasswordReset).toHaveBeenCalledTimes(1);
      resetToken = extractResetToken();
      expect(resetToken.length).toBeGreaterThanOrEqual(64);
    });

    it('forgot-password with an unknown email returns the same 201 response', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: `ghost-${Date.now()}@test.dev` })
        .expect(201);

      expect(res.body).toEqual({ ok: true });
      expect(mailMock.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('reset-password with the token allows login with the new password', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: resetToken, password: resetPassword })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(401);

      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/auth/login')
        .send({ email, password: resetPassword })
        .expect(201);
      const me = await agent.get('/auth/me').expect(200);
      expect((me.body as { user: { email: string } }).user.email).toBe(email);
    });

    it('reusing the same token returns a generic 401', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: resetToken, password: 'AnotherPassword123!' })
        .expect(401);
    });
  });
});
