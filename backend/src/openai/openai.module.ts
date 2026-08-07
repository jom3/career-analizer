import { Global, Module } from '@nestjs/common';
import { OpenaiService } from './openai.service';

// Modulo global: expone OpenaiService a cualquier modulo sin re-importarlo.
@Global()
@Module({
  providers: [OpenaiService],
  exports: [OpenaiService],
})
export class OpenaiModule {}
