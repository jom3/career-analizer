import { BadGatewayException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OpenaiService } from '../openai/openai.service';
import {
  CvAdaptationParserService,
  type AdaptationInput,
} from './cv-adaptation-parser.service';

describe('CvAdaptationParserService', () => {
  let service: CvAdaptationParserService;
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

  const input: AdaptationInput = {
    profile: {
      headline: null,
      skills: [{ id: 's1', name: 'TypeScript', level: 4 }],
      experiences: [
        {
          id: 'exp-1',
          position: 'Senior Engineer',
          company: 'Acme',
          location: null,
          startDate: null,
          endDate: null,
          current: true,
          description: 'Built APIs with TypeScript.',
          metrics: ['Cut latency by 40%'],
        },
      ],
      education: [],
      certifications: [],
      projects: [],
      languages: [{ id: 'l1', name: 'English', level: 'C1' }],
    },
    offer: {
      title: 'Senior Software Engineer',
      company: 'Acme',
      requiredSkills: ['TypeScript'],
      preferredSkills: [],
      keywords: ['backend'],
      experienceSummary: null,
    },
    matchedSkills: ['TypeScript'],
    missingSkills: ['NestJS'],
    sourceLanguage: 'en',
  };

  const validResponse = {
    experienceDescriptions: [
      {
        originalId: 'exp-1',
        text: 'Adapted description focusing on backend APIs.',
      },
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CvAdaptationParserService,
        { provide: ConfigService, useValue: configMock },
        { provide: OpenaiService, useValue: openaiMock },
      ],
    }).compile();

    service = module.get(CvAdaptationParserService);
  });

  it('normaliza experienceDescriptions de la respuesta de la IA', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validResponse) } }],
    });

    const result = await service.adapt(input);

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'test-model',
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'cv_adaptation',
            strict: true,
            schema: expect.any(Object) as object,
          },
        },
      }),
    );
    expect(result).toEqual(validResponse);
  });

  it('instruye escribir en el idioma de la oferta (sourceLanguage)', async () => {
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
    await service.adapt({ ...input, sourceLanguage: 'en' });
    expect(lastCallSystem()).toContain('in English');

    await service.adapt({ ...input, sourceLanguage: 'es' });
    expect(lastCallSystem()).toContain('in Spanish');
  });

  it('lanza 502 cuando el JSON de la IA no es parseable', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: 'esto no es json' } }],
    });

    await expect(service.adapt(input)).rejects.toThrow(BadGatewayException);
  });

  it('lanza 502 cuando la respuesta viene vacía', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    await expect(service.adapt(input)).rejects.toThrow(BadGatewayException);
  });

  it('lanza 502 cuando la forma es inválida (experienceDescriptions sin text)', async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              experienceDescriptions: [{ originalId: 'exp-1' }],
            }),
          },
        },
      ],
    });

    await expect(service.adapt(input)).rejects.toThrow(BadGatewayException);
  });

  it('descarta descripciones que afirman un skill faltante de la oferta', async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              experienceDescriptions: [
                {
                  originalId: 'exp-1',
                  text: 'Built APIs with NestJS and Python.',
                },
                { originalId: 'exp-1', text: 'Focused on backend services.' },
              ],
            }),
          },
        },
      ],
    });

    const result = await service.adapt(input);

    expect(result.experienceDescriptions).toEqual([
      { originalId: 'exp-1', text: 'Focused on backend services.' },
    ]);
  });

  it('mantiene descripciones que solo citan skills del perfil', async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              experienceDescriptions: [
                {
                  originalId: 'exp-1',
                  text: 'Built APIs with TypeScript.',
                },
              ],
            }),
          },
        },
      ],
    });

    const result = await service.adapt(input);

    expect(result.experienceDescriptions).toEqual([
      { originalId: 'exp-1', text: 'Built APIs with TypeScript.' },
    ]);
  });
});
