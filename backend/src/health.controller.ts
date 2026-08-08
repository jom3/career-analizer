import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('health')
  async check(): Promise<{ status: string }> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}
