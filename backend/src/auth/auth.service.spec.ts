import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  const userRow = {
    id: 'user-1',
    email: 'ana@test.dev',
    name: 'Ana',
    passwordHash: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  type CreateUserArgs = {
    data: { email: string; name: string; passwordHash: string };
  };
  const createMock = jest.fn<Promise<typeof userRow>, [CreateUserArgs]>();
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      create: createMock,
    },
  };
  const jwtMock = { sign: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
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
});
