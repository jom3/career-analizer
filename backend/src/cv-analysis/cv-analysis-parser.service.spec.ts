import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { OpenaiService } from '../openai/openai.service';
import { CvAnalysisParserService } from './cv-analysis-parser.service';

const profile = {
  id: 'profile-1',
  userId: 'user-1',
  headline: 'Backend Developer',
  phone: null,
  location: null,
  website: null,
  linkedin: null,
  summary: 'Backend con Node.js.',
  source: 'USER',
  experiences: [],
  skills: [{ id: 's1', profileId: 'p1', name: 'Node.js', level: 4, sortOrder: 0, source: 'USER', createdAt: new Date(), updatedAt: new Date() }],
  education: [],
  certifications: [],
  projects: [],
  languages: [],
  createdAt: new Date(),
  updatedAt: new Date(),
} as never;

describe('CvAnalysisParserService', () => {
  let service: CvAnalysisParserService;
  const createMock = jest.fn();
  const openaiMock = {
    client: { chat: { completions: { create: createMock } } },
  };
  const configMock = {
    get: jest.fn().mockImplementation((key: string, fallback?: string) =>
      key === 'OPENAI_MODEL' ? 'test-model' : fallback,
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CvAnalysisParserService,
        { provide: ConfigService, useValue: configMock },
        { provide: OpenaiService, useValue: openaiMock },
      ],
    }).compile();
    service = module.get(CvAnalysisParserService);
  });

  function reply(payload: unknown): void {
    createMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(payload) } }],
    });
  }

  it('normaliza fortalezas y sugerencias, y recorta a 4', async () => {
    reply({
      strengths: ['A', 'B', 'C', 'D', 'E'],
      suggestions: [
        { section: 'experience', action: 'Sumá métricas.' },
        { section: 'skills', action: 'Ordená las skills.' },
        { section: 'education', action: 'Agregá el título.' },
        { section: 'projects', action: 'Sumá un proyecto.' },
        { section: 'languages', action: 'Agregá idiomas.' },
      ],
    });

    const result = await service.review(profile, 'es');

    expect(result.strengths).toHaveLength(4);
    expect(result.suggestions).toHaveLength(4);
    expect(result.suggestions[0]).toEqual({
      section: 'experience',
      action: 'Sumá métricas.',
    });
  });

  it('descarta sugerencias con sección inválida', async () => {
    reply({
      strengths: ['Usa Node.js.'],
      suggestions: [
        { section: 'invented', action: 'Hacé algo.' },
        { section: 'skills', action: 'Ordená las skills.' },
      ],
    });

    const result = await service.review(profile, 'es');

    expect(result.suggestions).toEqual([
      { section: 'skills', action: 'Ordená las skills.' },
    ]);
  });

  it('descarta acciones vacías y duplicadas', async () => {
    reply({
      strengths: ['Usa Node.js.'],
      suggestions: [
        { section: 'skills', action: '  ' },
        { section: 'skills', action: 'Ordená las skills.' },
        { section: 'skills', action: 'ordená las skills.' },
      ],
    });

    const result = await service.review(profile, 'es');

    expect(result.suggestions).toHaveLength(1);
  });

  it('usa temperature 0 y el idioma pedido', async () => {
    reply({ strengths: ['A'], suggestions: [] });

    await service.review(profile, 'en');

    const call = (
      createMock.mock.calls[0] as unknown as Array<{
        temperature: number;
        messages: { role: string; content: string }[];
      }>
    )[0];
    expect(call.temperature).toBe(0);
    expect(call.messages[0].content).toContain('in English');
  });

  it('lanza 502 cuando la respuesta viene vacía', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: null } }] });

    await expect(service.review(profile, 'es')).rejects.toThrow(
      BadGatewayException,
    );
  });
});
