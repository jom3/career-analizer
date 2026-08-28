import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import type { UserModel } from '../generated/prisma/models/User.js';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

export type SafeUser = Pick<UserModel, 'id' | 'email' | 'name' | 'createdAt'>;
export type TokenUser = Pick<SafeUser, 'id' | 'email' | 'name'>;

const BCRYPT_ROUNDS = 10;
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
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

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      return;
    }
    const token = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetTokenHash: tokenHash, resetTokenExpiry: expiresAt },
    });
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:4200');
    const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;
    await this.mailService.sendPasswordReset(user.email, resetUrl);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { resetTokenHash: { not: null }, resetTokenExpiry: { not: null } },
    });
    let target: UserModel | undefined;
    for (const user of users) {
      if (
        user.resetTokenHash &&
        (await bcrypt.compare(dto.token, user.resetTokenHash))
      ) {
        target = user;
        break;
      }
    }
    if (
      !target ||
      !target.resetTokenExpiry ||
      target.resetTokenExpiry < new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: target.id },
      data: { passwordHash, resetTokenHash: null, resetTokenExpiry: null },
    });
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
