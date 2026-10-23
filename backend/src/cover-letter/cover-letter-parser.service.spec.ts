import { BadGatewayException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OpenaiService } from '../openai/openai.service';
import {
  CoverLetterParserService,
  type CoverLetterGenerationInput,
} from './cover-letter-parser.service';

const cleanLetter =
  'Dear María López,\n\nBuilt APIs with TypeScript.\n\nI am available for an interview this week.';
const employerViolation =
  'Dear María López,\n\nAt Acme I built APIs.\n\nI am available for an interview.';

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

  function mockReply(content: string): void {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ content }) } }],
    });
  }

  function systemPrompts(): string[] {
    return (
      createMock.mock.calls as unknown as Array<
        Array<{ messages: { role: string; content: string }[] }>
      >
    ).map((call) => call[0].messages[0].content);
  }

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

  it('con un borrador limpio hace una sola llamada y no devuelve advertencias', async () => {
    mockReply(cleanLetter);

    const result = await service.generate(input);

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(result.warnings).toEqual([]);
    expect(result.content).toBe(cleanLetter);
    expect(result.wordCount).toBe(cleanLetter.split(/\s+/).length);
  });

  it('usa temperature 0 en todas las llamadas', async () => {
    mockReply(cleanLetter);

    await service.generate(input);

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0 }) as object,
    );
  });

  it('envía el recruiter y la nota al modelo', async () => {
    mockReply(cleanLetter);

    await service.generate(input);

    const content = JSON.stringify(
      (
        createMock.mock.calls[0] as unknown as Array<{
          messages: { content: string }[];
        }>
      )[0].messages,
    );
    expect(content).toContain('María López');
    expect(content).toContain('Vi la vacante en LinkedIn');
  });

  it('envía el match de la oferta cuando existe', async () => {
    mockReply(cleanLetter);

    await service.generate({
      ...input,
      match: {
        overallScore: 70,
        overallJustification: 'Buen encaje.',
        dimensions: [],
        gaps: [{ name: 'NestJS', status: 'MISSING' }],
      },
    });

    const content = JSON.stringify(
      (
        createMock.mock.calls[0] as unknown as Array<{
          messages: { content: string }[];
        }>
      )[0].messages,
    );
    expect(content).toContain('Job match analysis');
    expect(content).toContain('NestJS');
  });

  it('instruye escribir en el idioma del documento', async () => {
    mockReply(cleanLetter);
    await service.generate({ ...input, lang: 'en' });
    expect(systemPrompts()[0]).toContain('in English');

    createMock.mockClear();
    mockReply(cleanLetter);
    await service.generate({ ...input, lang: 'es' });
    expect(systemPrompts()[0]).toContain('in Spanish');
  });

  it('pide cierre con próximo paso y límite de palabras en el prompt', () => {
    mockReply(cleanLetter);

    return service.generate(input).then(() => {
      const prompt = systemPrompts()[0];
      expect(prompt).toContain('next step');
      expect(prompt).toContain('180');
      expect(prompt).toContain('Never invent');
    });
  });

  it('corrige una infracción con una segunda llamada que recibe la lista exacta', async () => {
    mockReply(employerViolation);
    mockReply(cleanLetter);

    const result = await service.generate(input);

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(result.warnings).toEqual([]);
    expect(result.content).toBe(cleanLetter);
    expect(systemPrompts()[1]).toContain('Remove the employer name "Acme"');
  });

  it('corrige una cifra que no existe en el perfil ni en la oferta', async () => {
    mockReply(
      'Dear María López,\n\nI cut latency by 90%.\n\nI am available for an interview this week.',
    );
    mockReply(cleanLetter);

    await service.generate(input);

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(systemPrompts()[1]).toContain('figures');
  });

  it('no marca cifras que ya están en el perfil u oferta', async () => {
    mockReply(
      'Dear María López,\n\nI cut latency by 40%.\n\nI am available for an interview this week.',
    );

    const result = await service.generate(input);

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(result.warnings).toEqual([]);
  });

  it('entrega la carta con advertencias si la infracción persiste', async () => {
    mockReply(employerViolation);
    mockReply(employerViolation);

    const result = await service.generate(input);

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(result.content).toBe(employerViolation);
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      'EMPLOYER_NAME',
    ]);
  });

  it('nunca hace más de dos llamadas', async () => {
    mockReply(employerViolation);
    mockReply(employerViolation);

    await service.generate(input);

    expect(createMock.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('devuelve el borrador con advertencias si la corrección falla', async () => {
    mockReply(employerViolation);
    createMock.mockRejectedValueOnce(new Error('boom'));

    const result = await service.generate(input);

    expect(result.content).toBe(employerViolation);
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      'EMPLOYER_NAME',
    ]);
  });

  it('lanza 502 cuando el JSON de la IA no es parseable', async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: 'esto no es json' } }],
    });

    await expect(service.generate(input)).rejects.toThrow(BadGatewayException);
  });

  it('lanza 502 cuando la respuesta viene vacía', async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: null } }],
    });

    await expect(service.generate(input)).rejects.toThrow(BadGatewayException);
  });

  it('lanza 502 cuando la forma es inválida (content vacío)', async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ content: '   ' }) } }],
    });

    await expect(service.generate(input)).rejects.toThrow(BadGatewayException);
  });
});
