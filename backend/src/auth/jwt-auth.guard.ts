import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import type { TokenUser } from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: TokenUser }>();
    const token = request.cookies?.['access_token'] as string | undefined;
    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    try {
      const payload = this.jwtService.verify(token) as unknown as {
        sub?: string;
        email?: string;
        name?: string;
      };
      if (payload.sub) {
        request.user = {
          id: payload.sub,
          email: payload.email ?? '',
          name: payload.name ?? '',
        };
        return true;
      }
    } catch {
      // intencional: token invalido o expirado, se rechaza abajo
    }

    throw new UnauthorizedException('Invalid or expired token');
  }
}
