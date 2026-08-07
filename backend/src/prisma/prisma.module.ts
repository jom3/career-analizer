import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Modulo global: expone PrismaService a cualquier modulo sin re-importarlo.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
