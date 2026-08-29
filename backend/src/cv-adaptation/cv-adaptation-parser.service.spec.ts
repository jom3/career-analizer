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
    summaryFacts: {
      role: 'Senior Engineer',
      years: 4,
      workType: 'salaried',
      currentCompany: 'Acme',
      featuredProject: null,
      featuredSkills: ['TypeScript'],
      quality: { kind: 'performance', evidence: 'Cut latency by 40%' },
      lang: 'en',
    },
  };

  const validResponse = {
    summary:
      'Senior Engineer with 4 years of experience building backend APIs.',
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

  it('instruye no afirmar dominio sobre skills de nivel bajo (SPEC 20)', async () => {
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
    await service.adapt(input);

    expect(lastCallSystem()).toContain('level 3 or below');
    expect(lastCallSystem()).toContain('expert');
    expect(lastCallSystem()).toContain('never present a level 1-2 skill');
  });

  it('instruye generar el resumen con hechos del sistema y estructura del usuario', async () => {
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
    await service.adapt(input);

    const system = lastCallSystem();
    expect(system).toContain('THE SUMMARY');
    expect(system).toContain('60-80 words');
    expect(system).toContain('NEVER use first person');
    expect(system).toContain('NEVER say the candidate is learning');
    expect(system).toContain('never mention skills below the featured list');
    expect(system).toContain('at most 8-10 words');
    expect(system).toContain('do NOT dedicate a separate sentence to it');
  });

  it('envía los hechos permitidos para el resumen al prompt', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validResponse) } }],
    });
    await service.adapt(input);

    const call = createMock.mock.calls[0] as unknown as Array<{
      messages: Array<{ role: string; content: string }>;
    }>;
    const userMessages = call[0].messages.filter(
      (message) => message.role === 'user',
    );
    const factsMessage = userMessages.find((message) =>
      message.content.includes('Hechos reales permitidos para el resumen'),
    );
    expect(factsMessage).toBeDefined();
    expect(factsMessage?.content).toContain('"role":"Senior Engineer"');
    expect(factsMessage?.content).toContain('TypeScript');
  });

  it('normaliza el summary de la respuesta de la IA', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validResponse) } }],
    });

    const result = await service.adapt(input);

    expect(result.summary).toBe(
      'Senior Engineer with 4 years of experience building backend APIs.',
    );
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

  it('descarta el summary que afirma una skill faltante de la oferta', async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: 'Expert in NestJS building microservices.',
              experienceDescriptions: [
                { originalId: 'exp-1', text: 'Built APIs with TypeScript.' },
              ],
            }),
          },
        },
      ],
    });

    const result = await service.adapt(input);

    expect(result.summary).toBeNull();
    expect(result.experienceDescriptions).toHaveLength(1);
  });

  it('descarta el summary que promete aprender un skill', async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: 'Committed to learning React to contribute to the role.',
              experienceDescriptions: [
                { originalId: 'exp-1', text: 'Built APIs with TypeScript.' },
              ],
            }),
          },
        },
      ],
    });

    const result = await service.adapt(input);

    expect(result.summary).toBeNull();
    expect(result.experienceDescriptions).toHaveLength(1);
  });

  it('mantiene el summary limpio junto a las descripciones', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validResponse) } }],
    });

    const result = await service.adapt(input);

    expect(result.summary).toBe(validResponse.summary);
    expect(result.experienceDescriptions).toEqual(
      validResponse.experienceDescriptions,
    );
  });
});
