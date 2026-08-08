import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { UserModel } from '../generated/prisma/models/User.js';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export type SafeUser = Pick<UserModel, 'id' | 'email' | 'name' | 'createdAt'>;
export type TokenUser = Pick<SafeUser, 'id' | 'email' | 'name'>;

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<SafeUser> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email: dto.email, passwordHash, name: dto.name },
      });
      await tx.profile.create({
        data: { userId: created.id },
      });
      return created;
    });
    return this.sanitize(user);
  }

  async login(dto: LoginDto): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    const passwordMatch =
      user && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!user || !passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.sanitize(user);
  }

  signToken(user: SafeUser): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      name: user.name,
    });
  }

  async getUserById(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.sanitize(user);
  }

  private sanitize(user: UserModel): SafeUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }
}
