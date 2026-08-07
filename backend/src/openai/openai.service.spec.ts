import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import OpenAI from 'openai';
import { OpenaiModule } from './openai.module';
import { OpenaiService } from './openai.service';

describe('OpenaiService', () => {
  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it('resuelve el servicio y expone un client OpenAI construido con la key del entorno', async () => {
    process.env.OPENAI_API_KEY = 'test-api-key';

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), OpenaiModule],
    }).compile();

    const service = moduleRef.get(OpenaiService);

    expect(service).toBeDefined();
    expect(service.client).toBeInstanceOf(OpenAI);
  });
});
