import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

// Servicio que expone el client oficial de OpenAI como provider inyectable.
@Injectable()
export class OpenaiService {
  private readonly openaiClient: OpenAI;

  constructor(configService: ConfigService) {
    this.openaiClient = new OpenAI({
      apiKey: configService.getOrThrow<string>('OPENAI_API_KEY'),
    });
  }

  get client(): OpenAI {
    return this.openaiClient;
  }
}
