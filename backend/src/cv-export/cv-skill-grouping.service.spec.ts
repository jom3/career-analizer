import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OpenaiService } from '../openai/openai.service';
import { CvSkillGroupingService } from './cv-skill-grouping.service';

describe('CvSkillGroupingService', () => {
  let service: CvSkillGroupingService;
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
        CvSkillGroupingService,
        { provide: ConfigService, useValue: configMock },
        { provide: OpenaiService, useValue: openaiMock },
      ],
    }).compile();

    service = module.get(CvSkillGroupingService);
  });

  it('agrupa habilidades respetando el casing y orden originales', async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              categories: [
                {
                  label: 'Languages',
                  skills: ['TypeScript', 'Python'],
                },
                {
                  label: 'Databases',
                  skills: ['PostgreSQL'],
                },
              ],
            }),
          },
        },
      ],
    });

    const result = await service.group(
      ['TypeScript', 'PostgreSQL', 'Python', 'Angular'],
      'en',
    );

    expect(result).toEqual([
      { label: 'Languages', skills: ['TypeScript', 'Python'] },
      { label: 'Databases', skills: ['PostgreSQL'] },
      { label: null, skills: ['Angular'] },
    ]);
  });

  it('descarta skills que la IA inventa (no están en la lista)', async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              categories: [
                {
                  label: 'Languages',
                  skills: ['TypeScript', 'Django', 'Docker'],
                },
              ],
            }),
          },
        },
      ],
    });

    const result = await service.group(
      ['TypeScript', 'Python', 'Angular', 'PostgreSQL'],
      'en',
    );

    expect(result).toEqual([
      { label: 'Languages', skills: ['TypeScript'] },
      { label: null, skills: ['Python', 'Angular', 'PostgreSQL'] },
    ]);
  });

  it('agrega al final toda skill real que la IA omitió', async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              categories: [{ label: 'Languages', skills: ['Angular'] }],
            }),
          },
        },
      ],
    });

    const result = await service.group(
      ['Angular', 'React', 'Docker', 'Kubernetes'],
      'en',
    );

    expect(result).toEqual([
      { label: 'Languages', skills: ['Angular'] },
      { label: null, skills: ['React', 'Docker', 'Kubernetes'] },
    ]);
  });

  it('deduplica skills repetidas en una categoría', async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              categories: [
                {
                  label: 'Languages',
                  skills: ['TypeScript', 'typescript', 'TypeScript'],
                },
              ],
            }),
          },
        },
      ],
    });

    const result = await service.group(
      ['TypeScript', 'Python', 'Angular', 'PostgreSQL'],
      'en',
    );

    expect(result).toEqual([
      { label: 'Languages', skills: ['TypeScript'] },
      { label: null, skills: ['Python', 'Angular', 'PostgreSQL'] },
    ]);
  });

  it('devuelve un único grupo sin llamar a la IA con pocas skills', async () => {
    const result = await service.group(['TypeScript', 'Python'], 'en');

    expect(createMock).not.toHaveBeenCalled();
    expect(result).toEqual([{ label: null, skills: ['TypeScript', 'Python'] }]);
  });

  it('vuelve a un solo grupo de fallback cuando la IA falla', async () => {
    createMock.mockRejectedValue(new Error('network down'));

    const result = await service.group(
      ['TypeScript', 'Python', 'Angular', 'Docker'],
      'en',
    );

    expect(result).toEqual([
      { label: null, skills: ['TypeScript', 'Python', 'Angular', 'Docker'] },
    ]);
  });

  it('vuelve a fallback cuando la respuesta no tiene categorías', async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: '{"something": true}' } }],
    });

    const result = await service.group(
      ['TypeScript', 'Python', 'Angular', 'Docker'],
      'es',
    );

    expect(result).toEqual([
      { label: null, skills: ['TypeScript', 'Python', 'Angular', 'Docker'] },
    ]);
  });
});
