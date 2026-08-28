import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  const userRow = {
    id: 'user-1',
    email: 'ana@test.dev',
    name: 'Ana',
    passwordHash: '',
    resetTokenHash: null as string | null,
    resetTokenExpiry: null as Date | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  type CreateUserArgs = {
    data: { email: string; name: string; passwordHash: string };
  };
  const createMock = jest.fn<Promise<typeof userRow>, [CreateUserArgs]>();
  const profileCreateMock = jest.fn().mockResolvedValue({});
  const updateMock = jest.fn<Promise<typeof userRow>, [unknown]>();
  const transactionMock = {
    user: { create: createMock },
    profile: { create: profileCreateMock },
  };
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: createMock,
      update: updateMock,
    },
    $transaction: jest.fn(
      async (callback: (tx: typeof transactionMock) => Promise<unknown>) =>
        callback(transactionMock),
    ),
  };
  const jwtMock = { sign: jest.fn() };
  const mailMock = { sendPasswordReset: jest.fn() };
  const configMock = { get: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    configMock.get.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'APP_URL') return defaultValue ?? 'http://localhost:4200';
      return defaultValue;
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: MailService, useValue: mailMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('creates the user with a hashed password and returns it sanitized', async () => {
      const dto = {
        name: 'Ana',
        email: 'ana@test.dev',
        password: 'Password123!',
      };
      prismaMock.user.findUnique.mockResolvedValue(null);
      createMock.mockResolvedValue({
        ...userRow,
        passwordHash: 'hash',
      });

      const result = await service.register(dto);

      expect(createMock).toHaveBeenCalledTimes(1);
      const data = createMock.mock.calls[0][0].data;
      expect(data).toMatchObject({ email: dto.email, name: dto.name });
      expect(data.passwordHash).not.toBe(dto.password);
      expect(await bcrypt.compare(dto.password, data.passwordHash)).toBe(true);
      expect(profileCreateMock).toHaveBeenCalledWith({
        data: { userId: 'user-1' },
      });
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).toMatchObject({
        id: 'user-1',
        email: dto.email,
        name: dto.name,
      });
    });

    it('rejects with 409 when the email is already registered', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'other' });

      await expect(
        service.register({
          name: 'Ana',
          email: 'ana@test.dev',
          password: 'Password123!',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns the sanitized user when credentials match', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...userRow,
        passwordHash: await bcrypt.hash('Password123!', 10),
      });

      const result = await service.login({
        email: 'ana@test.dev',
        password: 'Password123!',
      });

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe('ana@test.dev');
    });

    it('rejects with 401 when the password is wrong', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...userRow,
        passwordHash: await bcrypt.hash('Password123!', 10),
      });

      await expect(
        service.login({ email: 'ana@test.dev', password: 'WrongPassword1!' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects with 401 when the user does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ghost@test.dev', password: 'Password123!' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('signToken', () => {
    it('signs a token with the user payload', () => {
      jwtMock.sign.mockReturnValue('signed-token');
      const user = { id: 'user-1', email: 'ana@test.dev', name: 'Ana' };

      const token = service.signToken(user);

      expect(jwtMock.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'ana@test.dev',
        name: 'Ana',
      });
      expect(token).toBe('signed-token');
    });
  });

  describe('getUserById', () => {
    it('returns the sanitized user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(userRow);

      const result = await service.getUserById('user-1');

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.id).toBe('user-1');
    });

    it('rejects with 401 when the user does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserById('missing')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('forgotPassword', () => {
    it('stores a hashed token with 1h expiry and sends the reset email', async () => {
      prismaMock.user.findUnique.mockResolvedValue(userRow);
      const resetUrl = 'http://localhost:4200/auth/reset-password?token=';
      let capturedToken = '';

      updateMock.mockImplementation(
        (args: { where: { id: string }; data: { resetTokenHash: string } }) => {
          expect(args.where.id).toBe('user-1');
          expect(args.data.resetTokenHash).not.toBeNull();
          expect(args.data.resetTokenExpiry).toBeInstanceOf(Date);
          const expiry = args.data.resetTokenExpiry as Date;
          const diffMs = expiry.getTime() - Date.now();
          expect(diffMs).toBeGreaterThan(55 * 60 * 1000);
          expect(diffMs).toBeLessThanOrEqual(60 * 60 * 1000);
          return Promise.resolve({ ...userRow, ...args.data });
        },
      );

      mailMock.sendPasswordReset.mockImplementation(
        (email: string, url: string) => {
          expect(email).toBe('ana@test.dev');
          expect(url.startsWith(resetUrl)).toBe(true);
          capturedToken = url.replace(resetUrl, '');
          return Promise.resolve();
        },
      );

      await service.forgotPassword({ email: 'ana@test.dev' });

      expect(prismaMock.user.update).toHaveBeenCalledTimes(1);
      expect(mailMock.sendPasswordReset).toHaveBeenCalledTimes(1);
      expect(capturedToken.length).toBeGreaterThanOrEqual(64);
    });

    it('does nothing (no token, no email) when the email does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await service.forgotPassword({ email: 'ghost@test.dev' });

      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(mailMock.sendPasswordReset).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('updates the password and clears the token (single use)', async () => {
      const token = 'a'.repeat(64);
      const tokenHash = await bcrypt.hash(token, 10);
      prismaMock.user.findMany.mockResolvedValue([
        {
          ...userRow,
          resetTokenHash: tokenHash,
          resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
        },
      ]);
      updateMock.mockImplementation(
        (args: { where: { id: string }; data: { passwordHash: string } }) => {
          expect(args.where.id).toBe('user-1');
          expect(args.data.resetTokenHash).toBeNull();
          expect(args.data.resetTokenExpiry).toBeNull();
          return Promise.resolve({ ...userRow, ...args.data });
        },
      );

      await service.resetPassword({ token, password: 'NewPassword123!' });

      const updateArgs = updateMock.mock.calls[0][0] as {
        data: { passwordHash: string };
      };
      expect(
        await bcrypt.compare('NewPassword123!', updateArgs.data.passwordHash),
      ).toBe(true);
      expect(updateArgs.data).toMatchObject({
        resetTokenHash: null,
        resetTokenExpiry: null,
      });
    });

    it('rejects with 401 when the token is invalid', async () => {
      prismaMock.user.findMany.mockResolvedValue([
        {
          ...userRow,
          resetTokenHash: await bcrypt.hash('b'.repeat(64), 10),
          resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
        },
      ]);

      await expect(
        service.resetPassword({
          token: 'c'.repeat(64),
          password: 'NewPassword123!',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('rejects with 401 when the token is expired', async () => {
      prismaMock.user.findMany.mockResolvedValue([
        {
          ...userRow,
          resetTokenHash: await bcrypt.hash('a'.repeat(64), 10),
          resetTokenExpiry: new Date(Date.now() - 60 * 1000),
        },
      ]);

      await expect(
        service.resetPassword({
          token: 'a'.repeat(64),
          password: 'NewPassword123!',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });
  });
});
