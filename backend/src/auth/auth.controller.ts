import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { AuthService, type SafeUser } from './auth.service';
import { Public } from './decorators/public.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { RequestWithUser } from './request-with-user';

const COOKIE_NAME = 'access_token';
const COOKIE_MAX_AGE = 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SafeUser }> {
    const user = await this.authService.register(dto);
    this.setSessionCookie(res, user);
    return { user };
  }

  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: SafeUser }> {
    const user = await this.authService.login(dto);
    this.setSessionCookie(res, user);
    return { user };
  }

  @Public()
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response): { ok: true } {
    res.clearCookie(COOKIE_NAME, this.cookieOptions());
    return { ok: true };
  }

  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ ok: true }> {
    await this.authService.forgotPassword(dto);
    return { ok: true };
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ ok: true }> {
    await this.authService.resetPassword(dto);
    return { ok: true };
  }

  @Get('me')
  async me(@Req() req: RequestWithUser): Promise<{ user: SafeUser }> {
    const user = await this.authService.getUserById(req.user.id);
    return { user };
  }

  private setSessionCookie(res: Response, user: SafeUser): void {
    res.cookie(
      COOKIE_NAME,
      this.authService.signToken(user),
      this.cookieOptions(),
    );
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    };
  }
}
