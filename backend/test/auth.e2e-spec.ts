import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  const email = `e2e-${Date.now()}@test.dev`;
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
});
