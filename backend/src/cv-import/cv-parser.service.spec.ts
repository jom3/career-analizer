import { BadGatewayException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OpenaiService } from '../openai/openai.service';
import { CvParserService } from './cv-parser.service';
import { Source } from '../generated/prisma/enums.js';

describe('CvParserService', () => {
  let service: CvParserService;
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

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CvParserService,
        { provide: ConfigService, useValue: configMock },
        { provide: OpenaiService, useValue: openaiMock },
      ],
    }).compile();

    service = module.get(CvParserService);
  });

  it('normaliza la respuesta de la IA en un borrador con source CV_IMPORT', async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              headline: ' Software Engineer ',
              phone: null,
              location: 'Buenos Aires',
              website: null,
              linkedin: null,
              summary: 'Backend specialist with years of experience.',
              experiences: [
                {
                  company: 'Acme',
                  position: 'Senior Developer',
                  location: 'CABA',
                  startDate: '2020-01-01',
                  endDate: null,
                  current: true,
                  description: 'Led the backend team.',
                },
              ],
              skills: [
                { name: 'TypeScript', level: 4 },
                { name: 'Invisible', level: null },
              ],
              education: [],
              certifications: [],
              projects: [],
              languages: [{ name: 'English', level: 'C1' }],
            }),
          },
        },
      ],
    });

    const result = await service.parse(
      'Experiencia como Senior Developer en Acme. Inglés avanzado.',
    );

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'test-model',
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'cv_draft',
            strict: true,
            schema: expect.any(Object) as object,
          },
        },
      }),
    );
    expect(result.draft.headline).toBe('Software Engineer');
    expect(result.draft.experiences[0]).toMatchObject({
      company: 'Acme',
      current: true,
      source: Source.CV_IMPORT,
      sortOrder: 0,
    });
    expect(result.draft.skills[0]).toMatchObject({
      name: 'TypeScript',
      level: 4,
      source: Source.CV_IMPORT,
    });
    expect(result.draft.skills).toHaveLength(2);
  });

  it('normaliza niveles fuera de rango a null y descarta items sin dato clave', async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              headline: null,
              phone: null,
              location: null,
              website: null,
              linkedin: null,
              summary: null,
              experiences: [],
              skills: [
                { name: 'TypeScript', level: 9 },
                { name: '', level: null },
              ],
              education: [],
              certifications: [],
              projects: [],
              languages: [],
            }),
          },
        },
      ],
    });

    const result = await service.parse('texto de prueba');

    expect(result.draft.skills).toHaveLength(1);
    expect(result.draft.skills[0].name).toBe('TypeScript');
    expect(result.draft.skills[0].level).toBeNull();
  });

  it('detecta el idioma del texto (es/en)', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: '{}' } }],
    });
    const spanish = await service.parse(
      'Experiencia laboral y habilidades en resumen profesional.',
    );
    expect(spanish.sourceLanguage).toBe('es');

    const english = await service.parse(
      'Work experience and skills summary for a professional profile.',
    );
    expect(english.sourceLanguage).toBe('en');
  });

  it('incluye en el prompt la instrucción de texto limpio y no duplicar ítems', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: '{}' } }],
    });

    await service.parse(
      'Experiencia laboral y habilidades en resumen profesional.',
    );

    const createCall = createMock.mock.calls[0] as unknown as Array<{
      messages: Array<{ role: string; content: string }>;
    }>;
    const systemPrompt = createCall[0].messages[0].content;
    expect(systemPrompt).toMatch(/ligaduras/i);
    expect(systemPrompt).toMatch(/no dupliques|do not duplicate/i);
    expect(systemPrompt).toMatch(
      /respetá la grafía|reproduce the cv spelling/i,
    );
  });

  it('lanza 502 cuando el JSON de la IA no es parseable', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: 'esto no es json' } }],
    });

    await expect(service.parse('texto')).rejects.toThrow(BadGatewayException);
  });

  it('lanza 502 cuando la respuesta viene vacía', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    await expect(service.parse('texto')).rejects.toThrow(BadGatewayException);
  });
});
