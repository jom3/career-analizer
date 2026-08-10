import { BadGatewayException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OpenaiService } from '../openai/openai.service';
import {
  CoverLetterParserService,
  type CoverLetterGenerationInput,
} from './cover-letter-parser.service';

describe('CoverLetterParserService', () => {
  let service: CoverLetterParserService;
  const createMock = jest.fn();
  const openaiMock = {
    client: {
      chat: {
        completions: {
          create: createMock,
        },
      },
    },
  };
  const configMock = {
    get: jest
      .fn()
      .mockImplementation((key: string, fallback?: string) =>
        key === 'OPENAI_MODEL' ? 'test-model' : fallback,
      ),
  };

  const input: CoverLetterGenerationInput = {
    profile: {
      skills: [{ name: 'TypeScript', level: 4 }],
      experiences: [
        {
          position: 'Senior Engineer',
          company: 'Acme',
          description: 'Built APIs with TypeScript.',
          metrics: ['Cut latency by 40%'],
        },
      ],
      education: [],
      certifications: [],
      projects: [],
      languages: [{ name: 'English', level: 'C1' }],
    },
    offer: {
      title: 'Senior Software Engineer',
      company: 'Acme',
      responsibilities: ['Build backend services'],
      requiredSkills: ['TypeScript'],
      preferredSkills: [],
      experienceSummary: null,
      keywords: ['cloud', 'microservices'],
    },
    recruiterName: 'María López',
    note: 'Vi la vacante en LinkedIn y estoy disponible desde enero.',
    lang: 'en',
    match: null,
  };

  const validResponse = {
    content:
      'Dear María López,\n\nI am writing to apply for the Senior Software Engineer position at Acme.',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoverLetterParserService,
        { provide: ConfigService, useValue: configMock },
        { provide: OpenaiService, useValue: openaiMock },
      ],
    }).compile();

    service = module.get(CoverLetterParserService);
  });

  it('normaliza el content de la respuesta de la IA', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validResponse) } }],
    });

    const result = await service.generate(input);

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'test-model',
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'cover_letter',
            strict: true,
            schema: expect.any(Object) as object,
          },
        },
      }),
    );
    expect(result.content).toContain('Dear María López');
    expect(result.content).toContain('Senior Software Engineer');
  });

  it('envía el recruiter y la nota al modelo', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validResponse) } }],
    });

    await service.generate(input);

    const calls = createMock.mock.calls as unknown as Array<
      Array<{ messages: { role: string; content: string }[] }>
    >;
    const lastContent = calls[calls.length - 1][0].messages
      .filter((message) => message.role === 'user')
      .map((message) => message.content)
      .join(' ');
    expect(lastContent).toContain('María López');
    expect(lastContent).toContain('Vi la vacante en LinkedIn');
  });

  it('envía el match de la oferta cuando existe', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validResponse) } }],
    });

    await service.generate({
      ...input,
      match: {
        overallScore: 85,
        overallJustification: 'Strong fit on backend experience.',
        dimensions: [
          {
            key: 'skills',
            score: 90,
            justification: 'TypeScript is highly relevant.',
          },
        ],
        gaps: [{ name: 'GraphQL', status: 'PARTIAL' }],
      },
    });

    const calls = createMock.mock.calls as unknown as Array<
      Array<{ messages: { role: string; content: string }[] }>
    >;
    const matchPayload = calls[calls.length - 1][0].messages
      .map((message) => message.content)
      .join(' ');
    expect(matchPayload).toContain('Job match analysis');
    expect(matchPayload).toContain('Strong fit on backend experience.');
    expect(matchPayload).toContain('GraphQL');
  });

  it('instruye escribir en el idioma de lang', async () => {
    const lastCallSystem = (): string =>
      (
        createMock.mock.calls[
          createMock.mock.calls.length - 1
        ] as unknown as Array<{
          messages: { role: string; content: string }[];
        }>
      )[0].messages[0].content;

    createMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validResponse) } }],
    });
    await service.generate({ ...input, lang: 'en' });
    expect(lastCallSystem()).toContain('in English');

    await service.generate({ ...input, lang: 'es' });
    expect(lastCallSystem()).toContain('in Spanish');
  });

  it('instruye saludo genérico sin recruiter y sin afirmar skills ajenos', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validResponse) } }],
    });

    await service.generate({ ...input, recruiterName: null });

    const calls = createMock.mock.calls as unknown as Array<
      Array<{ messages: { role: string; content: string }[] }>
    >;
    const system = calls[calls.length - 1][0].messages[0].content;
    expect(system).toContain('generic localized greeting');
    expect(system).toContain('NEVER claim');
    expect(system).toContain('profile lacks');
  });

  it('instruye el estilo pedido: límite de palabras, sin apertura con nombre y sin frases de relleno', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validResponse) } }],
    });

    await service.generate(input);

    const calls = createMock.mock.calls as unknown as Array<
      Array<{ messages: { role: string; content: string }[] }>
    >;
    const system = calls[calls.length - 1][0].messages[0].content;
    expect(system).toContain('Maximum 180 words');
    expect(system).toContain('Do NOT open with "My name is');
    expect(system).toContain(
      'would this sentence work for any candidate at any company',
    );
    expect(system).toContain('deliver only the final corrected letter');
    expect(system).toContain('I am passionate about');
    expect(system).toContain('is key/essential/relevant/fundamental');
    expect(system).toContain('as a justification');
    expect(system).toContain('not a paragraph appended at the end');
    expect(system).toContain('DELETE IT COMPLETELY');
    expect(system).toContain('forced-connection sentence');
    expect(system).toContain('closing gerunds');
    expect(system).toContain('One idea per sentence');
    expect(system).toContain('Delete it rather than rewriting it');
  });

  it('lanza 502 cuando el JSON de la IA no es parseable', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: 'esto no es json' } }],
    });

    await expect(service.generate(input)).rejects.toThrow(BadGatewayException);
  });

  it('lanza 502 cuando la respuesta viene vacía', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    await expect(service.generate(input)).rejects.toThrow(BadGatewayException);
  });

  it('lanza 502 cuando la forma es inválida (content vacío)', async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ content: '   ' }),
          },
        },
      ],
    });

    await expect(service.generate(input)).rejects.toThrow(BadGatewayException);
  });
});
