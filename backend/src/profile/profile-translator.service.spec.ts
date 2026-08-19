import { BadGatewayException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OpenaiService } from '../openai/openai.service';
import {
  ProfileTranslatorService,
  type ProfileTranslationInput,
} from './profile-translator.service';
import type { ProfileWithCollections } from './profile.service';

function buildProfile(): ProfileWithCollections {
  return {
    id: 'profile-1',
    userId: 'user-1',
    headline: 'Ingeniero de software senior',
    phone: '+54 11 5555 5555',
    location: 'Buenos Aires, Argentina',
    website: 'https://example.com',
    linkedin: 'https://linkedin.com/in/user',
    summary: 'Especialista backend con enfoque en APIs.',
    headlineEs: 'Ingeniero de software senior',
    headlineEn: null,
    locationEs: 'Buenos Aires, Argentina',
    locationEn: null,
    summaryEs: 'Especialista backend con enfoque en APIs.',
    summaryEn: null,
    source: 'USER',
    createdAt: new Date(),
    updatedAt: new Date(),
    experiences: [
      {
        id: 'exp-1',
        profileId: 'profile-1',
        company: 'Acme',
        position: 'Ingeniero backend',
        location: 'Buenos Aires',
        startDate: new Date('2020-01-01'),
        endDate: null,
        current: true,
        description: 'Construí APIs REST con Node.js.',
        metrics: ['Reduje la latencia un 40%'],
        positionEs: 'Ingeniero backend',
        positionEn: null,
        locationEs: 'Buenos Aires',
        locationEn: null,
        descriptionEs: 'Construí APIs REST con Node.js.',
        descriptionEn: null,
        metricsEs: ['Reduje la latencia un 40%'],
        metricsEn: [],
        sortOrder: 0,
        source: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    skills: [
      {
        id: 'skill-1',
        profileId: 'profile-1',
        name: 'Docker',
        level: 4,
        sortOrder: 0,
        source: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    education: [],
    certifications: [],
    projects: [],
    languages: [],
  };
}

const input: ProfileTranslationInput = {
  profile: buildProfile(),
  sourceLang: 'es',
  targetLang: 'en',
};

const validResponse = {
  profile: {
    headline: 'Senior Software Engineer',
    location: 'Buenos Aires, Argentina',
    summary: 'Backend specialist focused on APIs.',
  },
  experiences: [
    {
      id: 'exp-1',
      position: 'Backend Engineer',
      location: 'Buenos Aires',
      description: 'Built REST APIs with Node.js.',
      metrics: ['Reduced latency by 40%'],
    },
  ],
  education: [],
  certifications: [],
  projects: [],
  languages: [],
};

describe('ProfileTranslatorService', () => {
  let service: ProfileTranslatorService;
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
        ProfileTranslatorService,
        { provide: ConfigService, useValue: configMock },
        { provide: OpenaiService, useValue: openaiMock },
      ],
    }).compile();

    service = module.get(ProfileTranslatorService);
  });

  it('normaliza la respuesta de la IA y devuelve solo los campos del idioma destino', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validResponse) } }],
    });

    const result = await service.translate(input);

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'test-model',
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'profile_translation',
            strict: true,
            schema: expect.any(Object) as object,
          },
        },
      }),
    );
    expect(result).toEqual(validResponse);
  });

  it('solo envía los campos de texto del perfil (sin skills ni techStack)', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validResponse) } }],
    });

    await service.translate(input);

    const call = createMock.mock.calls[0] as unknown as Array<{
      messages: { role: string; content: string }[];
    }>;
    const userMessage = call[0].messages[1].content;
    expect(userMessage).toContain('Ingeniero de software senior');
    expect(userMessage).not.toContain('Docker');
    expect(userMessage).not.toContain('+54');
    expect(userMessage).not.toContain('skills');
  });

  it('instruye escribir en el idioma destino y no traducir nombres propios', async () => {
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
    await service.translate({ ...input, targetLang: 'en' });
    expect(lastCallSystem()).toContain('natural, professional English');
    expect(lastCallSystem()).toContain('Do NOT translate proper nouns');
    expect(lastCallSystem()).toContain('Never add, remove, reorder or invent');
  });

  it('descarta ítems cuyo id no existe en el origen (la IA no inventa)', async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              ...validResponse,
              experiences: [
                ...validResponse.experiences,
                {
                  id: 'exp-invented',
                  position: 'Invented Role',
                  location: null,
                  description: 'Invented',
                  metrics: null,
                },
              ],
            }),
          },
        },
      ],
    });

    const result = await service.translate(input);

    expect(result.experiences).toEqual(validResponse.experiences);
  });

  it('descarta campos vacíos en la respuesta', async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              ...validResponse,
              profile: {
                headline: 'Senior Software Engineer',
                location: '   ',
                summary: 'Backend specialist focused on APIs.',
              },
            }),
          },
        },
      ],
    });

    const result = await service.translate(input);

    expect(result.profile.location).toBeNull();
  });

  it('lanza 502 cuando el JSON de la IA no es parseable', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: 'esto no es json' } }],
    });

    await expect(service.translate(input)).rejects.toThrow(BadGatewayException);
  });

  it('lanza 502 cuando la respuesta viene vacía', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    await expect(service.translate(input)).rejects.toThrow(BadGatewayException);
  });

  it('lanza 502 cuando la forma es inválida', async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              profile: { headline: 'x', location: 'x', summary: 'x' },
              experiences: 'not-an-array',
              education: [],
              certifications: [],
              projects: [],
              languages: [],
            }),
          },
        },
      ],
    });

    await expect(service.translate(input)).rejects.toThrow(BadGatewayException);
  });
});
