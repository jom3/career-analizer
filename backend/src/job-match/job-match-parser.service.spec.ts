import { BadGatewayException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OpenaiService } from '../openai/openai.service';
import { JobMatchParserService } from './job-match-parser.service';
import type { JobOfferDraft } from '../job-analysis/job-analysis.types';
import type { ProfileSnapshot } from './profile-util';

describe('JobMatchParserService', () => {
  let service: JobMatchParserService;
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

  const offer: JobOfferDraft = {
    title: 'Senior Software Engineer',
    company: 'Acme',
    level: 'Senior',
    responsibilities: [],
    requiredSkills: ['TypeScript', 'NestJS'],
    preferredSkills: ['Angular'],
    experienceYears: 5,
    experienceSummary: null,
    education: [],
    languages: ['English'],
    keywords: [],
  };

  const profile: ProfileSnapshot = {
    skills: [{ name: 'TypeScript', level: 4 }],
    experiences: [],
    education: [],
    certifications: [],
    projects: [],
    languages: [{ name: 'English', level: 'C1' }],
  };

  const validResponse = {
    overallScore: 78,
    overallJustification: 'Sólido encaje técnico.',
    dimensions: [
      { key: 'skills', score: 80, justification: 'TypeScript es clave.' },
      { key: 'experience', score: null, justification: 'Sin experiencias.' },
      { key: 'education', score: null, justification: 'Sin educación.' },
      { key: 'languages', score: 90, justification: 'Inglés C1.' },
    ],
    gaps: [
      {
        name: 'NestJS',
        status: 'MISSING',
        source: 'REQUIRED',
        note: 'No hay evidencia en el perfil.',
      },
    ],
    recommendations: [
      {
        type: 'SKILL',
        target: 'NestJS',
        suggestion: 'Sumar un proyecto con NestJS.',
      },
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobMatchParserService,
        { provide: ConfigService, useValue: configMock },
        { provide: OpenaiService, useValue: openaiMock },
      ],
    }).compile();

    service = module.get(JobMatchParserService);
  });

  it('normaliza la respuesta de la IA en un análisis de match', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validResponse) } }],
    });

    const result = await service.match(offer, profile, 'es');

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'test-model',
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'job_match_analysis',
            strict: true,
            schema: expect.any(Object) as object,
          },
        },
      }),
    );
    expect(result).toEqual({
      overallScore: 78,
      overallJustification: 'Sólido encaje técnico.',
      dimensions: [
        { key: 'skills', score: 80, justification: 'TypeScript es clave.' },
        { key: 'experience', score: null, justification: 'Sin experiencias.' },
        { key: 'education', score: null, justification: 'Sin educación.' },
        { key: 'languages', score: 90, justification: 'Inglés C1.' },
      ],
      gaps: [
        {
          name: 'NestJS',
          status: 'MISSING',
          source: 'REQUIRED',
          note: 'No hay evidencia en el perfil.',
        },
      ],
      recommendations: [
        {
          type: 'SKILL',
          target: 'NestJS',
          suggestion: 'Sumar un proyecto con NestJS.',
        },
      ],
    });
  });

  it('completa dimensiones faltantes con score null', async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              ...validResponse,
              dimensions: [
                {
                  key: 'skills',
                  score: 80,
                  justification: 'TypeScript es clave.',
                },
              ],
            }),
          },
        },
      ],
    });

    const result = await service.match(offer, profile, 'es');

    const keys = result.dimensions.map((d) => d.key);
    expect(keys.sort()).toEqual(
      ['skills', 'experience', 'education', 'languages'].sort(),
    );
    const experience = result.dimensions.find((d) => d.key === 'experience');
    expect(experience).toEqual({
      key: 'experience',
      score: null,
      justification: '',
    });
  });

  it('clampa los scores fuera de rango a 0-100', async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ ...validResponse, overallScore: 150 }),
          },
        },
      ],
    });

    const result = await service.match(offer, profile, 'es');
    expect(result.overallScore).toBe(100);
  });

  it('lanza 502 cuando el JSON de la IA no es parseable', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: 'esto no es json' } }],
    });

    await expect(service.match(offer, profile, 'es')).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('lanza 502 cuando la respuesta viene vacía', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    await expect(service.match(offer, profile, 'es')).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('lanza 502 cuando la forma es inválida (gaps sin name)', async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              ...validResponse,
              gaps: [{ status: 'MISSING', source: 'REQUIRED' }],
            }),
          },
        },
      ],
    });

    await expect(service.match(offer, profile, 'es')).rejects.toThrow(
      BadGatewayException,
    );
  });
});
