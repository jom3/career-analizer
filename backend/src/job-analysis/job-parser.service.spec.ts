import { BadGatewayException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OpenaiService } from '../openai/openai.service';
import { JobParserService, detectLanguage } from './job-parser.service';
import { JobLevel } from '../generated/prisma/enums.js';

describe('JobParserService', () => {
  let service: JobParserService;
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

  const validResponse = {
    title: ' Senior Software Engineer ',
    company: 'Acme',
    level: 'Senior',
    responsibilities: ['Build and ship features'],
    requiredSkills: ['TypeScript', 'NestJS'],
    preferredSkills: ['Angular'],
    experienceYears: 5,
    experienceSummary: '5+ years building backend services',
    education: ['Computer Science degree'],
    languages: ['English'],
    keywords: ['backend', 'nodejs'],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobParserService,
        { provide: ConfigService, useValue: configMock },
        { provide: OpenaiService, useValue: openaiMock },
      ],
    }).compile();

    service = module.get(JobParserService);
  });

  it('normaliza la respuesta de la IA en un borrador de oferta', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validResponse) } }],
    });

    const result = await service.parseText(
      'Senior Software Engineer at Acme. Requisitos: TypeScript.',
    );

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'test-model',
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'job_offer_draft',
            strict: true,
            schema: expect.any(Object) as object,
          },
        },
      }),
    );
    expect(result.draft).toEqual({
      title: 'Senior Software Engineer',
      company: 'Acme',
      level: JobLevel.Senior,
      responsibilities: ['Build and ship features'],
      requiredSkills: ['TypeScript', 'NestJS'],
      preferredSkills: ['Angular'],
      experienceYears: 5,
      experienceSummary: '5+ years building backend services',
      education: ['Computer Science degree'],
      languages: ['English'],
      keywords: ['backend', 'nodejs'],
    });
  });

  it('normaliza el nivel a la enum y deja null lo que no es un nivel válido', async () => {
    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({ ...validResponse, level: 'mid' }),
          },
        },
      ],
    });
    const mid = await service.parseText('texto');
    expect(mid.draft.level).toBe(JobLevel.Mid);

    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              ...validResponse,
              level: 'Principal Architect',
            }),
          },
        },
      ],
    });
    const principal = await service.parseText('texto');
    expect(principal.draft.level).toBeNull();
  });

  it('parsea una imagen enviándola como content part y detecta el idioma del draft', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validResponse) } }],
    });

    const result = await service.parseImage(
      Buffer.from('png-bytes'),
      'image/png',
    );

    const createCall = createMock.mock.calls[0] as unknown as Array<{
      messages: Array<{
        role: string;
        content: string | Array<{ type: string; image_url?: { url: string } }>;
      }>;
    }>;
    const userContent = createCall[0].messages[1].content;
    expect(Array.isArray(userContent)).toBe(true);
    const parts = userContent as Array<{
      type: string;
      image_url?: { url: string };
    }>;
    expect(parts[1]).toEqual({
      type: 'image_url',
      image_url: {
        url: 'data:image/png;base64,cG5nLWJ5dGVz',
      },
    });
    expect(result.draft.title).toBe('Senior Software Engineer');
    expect(result.sourceLanguage).toBe('en');
  });

  it('lanza 502 cuando el JSON de la IA no es parseable', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: 'esto no es json' } }],
    });

    await expect(service.parseText('texto')).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('lanza 502 cuando la respuesta viene vacía', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    await expect(service.parseText('texto')).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('detecta el idioma del texto (es/en/other)', () => {
    expect(
      detectLanguage('Requisitos: experiencia y habilidades en la empresa.'),
    ).toBe('es');
    expect(
      detectLanguage('Requirements: experience and skills at the company.'),
    ).toBe('en');
    expect(detectLanguage('....')).toBe('other');
  });

  it('descarta frases que la IA devuelve como skills y limpia puntuación final', async () => {
    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              ...validResponse,
              requiredSkills: [
                'TypeScript',
                'Más de 3 años desarrollando aplicaciones Full Stack.',
                'React avanzado.',
                'Node.js.',
                'Español fluido.',
              ],
              keywords: ['backend', 'Experiencia Fintech', 'GitHub Actions'],
            }),
          },
        },
      ],
    });

    const result = await service.parseText('texto');

    expect(result.draft.requiredSkills).toEqual([
      'TypeScript',
      'React',
      'Node.js',
    ]);
    expect(result.draft.keywords).toEqual(['backend', 'GitHub Actions']);
  });
});
