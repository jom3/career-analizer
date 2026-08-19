import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileService, profileInclude } from './profile.service';
import { ProfileTranslatorService } from './profile-translator.service';

describe('ProfileService', () => {
  let service: ProfileService;

  const profileRow = {
    id: 'profile-1',
    userId: 'user-1',
    headline: null,
    phone: null,
    location: null,
    website: null,
    linkedin: null,
    summary: null,
    headlineEs: null,
    headlineEn: null,
    locationEs: null,
    locationEn: null,
    summaryEs: null,
    summaryEn: null,
    source: 'USER',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function buildTxMock() {
    const delegate = () => ({
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    });
    return {
      profile: {
        findUnique: jest.fn().mockResolvedValue(profileRow),
        create: jest.fn().mockResolvedValue(profileRow),
        update: jest.fn().mockResolvedValue(profileRow),
        findUniqueOrThrow: jest.fn().mockResolvedValue(profileRow),
      },
      experience: delegate(),
      skill: delegate(),
      education: delegate(),
      certification: delegate(),
      project: delegate(),
      language: delegate(),
    };
  }

  let txMock: ReturnType<typeof buildTxMock>;
  const prismaMock = {
    profile: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const translatorMock = {
    translate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    txMock = buildTxMock();
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof txMock) => Promise<unknown>) =>
        callback(txMock),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ProfileTranslatorService, useValue: translatorMock },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
  });

  describe('getForUser', () => {
    it('returns the existing profile', async () => {
      prismaMock.profile.findUnique.mockResolvedValue(profileRow);

      const result = await service.getForUser('user-1');

      expect(prismaMock.profile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: profileInclude,
      });
      expect(result).toBe(profileRow);
    });

    it('creates an empty profile when it does not exist', async () => {
      prismaMock.profile.findUnique.mockResolvedValue(null);
      prismaMock.profile.create.mockResolvedValue(profileRow);

      const result = await service.getForUser('user-1');

      expect(prismaMock.profile.create).toHaveBeenCalledWith({
        data: { userId: 'user-1' },
        include: profileInclude,
      });
      expect(result).toBe(profileRow);
    });
  });

  describe('replaceForUser', () => {
    const emptySections = {
      education: [],
      certifications: [],
      projects: [],
      languages: [],
    };

    it('creates items, updates owned ids and deletes missing ones', async () => {
      txMock.experience.findMany.mockResolvedValue([{ id: 'exp-1' }]);
      txMock.skill.findMany.mockResolvedValue([]);
      txMock.education.findMany.mockResolvedValue([]);
      txMock.certification.findMany.mockResolvedValue([]);
      txMock.project.findMany.mockResolvedValue([]);
      txMock.language.findMany.mockResolvedValue([]);

      const dto = {
        headline: 'Software Engineer',
        experiences: [
          {
            id: 'exp-1',
            company: 'Acme',
            position: 'Engineer',
            current: false,
            sortOrder: 1,
          },
          {
            company: 'Other',
            position: 'Analyst',
            current: true,
            sortOrder: 2,
          },
        ],
        skills: [{ name: 'TypeScript', level: 4, sortOrder: 1 }],
        ...emptySections,
      };

      await service.replaceForUser('user-1', dto);

      expect(txMock.experience.deleteMany).toHaveBeenCalledWith({
        where: { profileId: 'profile-1', id: { notIn: ['exp-1'] } },
      });
      expect(txMock.experience.update).toHaveBeenCalledWith({
        where: { id: 'exp-1' },
        data: {
          company: 'Acme',
          position: 'Engineer',
          positionEs: null,
          positionEn: 'Engineer',
          location: null,
          locationEs: null,
          locationEn: null,
          startDate: null,
          endDate: null,
          current: false,
          description: null,
          descriptionEs: null,
          descriptionEn: null,
          metrics: [],
          metricsEs: [],
          metricsEn: [],
          source: 'USER',
          sortOrder: 1,
        },
      });
      expect(txMock.experience.create).toHaveBeenCalledWith({
        data: {
          profileId: 'profile-1',
          company: 'Other',
          position: 'Analyst',
          positionEs: null,
          positionEn: 'Analyst',
          location: null,
          locationEs: null,
          locationEn: null,
          startDate: null,
          endDate: null,
          current: true,
          description: null,
          descriptionEs: null,
          descriptionEn: null,
          metrics: [],
          metricsEs: [],
          metricsEn: [],
          source: 'USER',
          sortOrder: 2,
        },
      });
      expect(txMock.skill.create).toHaveBeenCalledWith({
        data: {
          profileId: 'profile-1',
          name: 'TypeScript',
          level: 4,
          source: 'USER',
          sortOrder: 1,
        },
      });
    });

    it('forces endDate to null when current is true', async () => {
      txMock.experience.findMany.mockResolvedValue([]);
      txMock.skill.findMany.mockResolvedValue([]);
      txMock.education.findMany.mockResolvedValue([]);
      txMock.certification.findMany.mockResolvedValue([]);
      txMock.project.findMany.mockResolvedValue([]);
      txMock.language.findMany.mockResolvedValue([]);

      await service.replaceForUser('user-1', {
        experiences: [
          {
            company: 'Acme',
            position: 'Engineer',
            endDate: '2021-01-01T00:00:00.000Z',
            current: true,
            sortOrder: 1,
          },
        ],
        skills: [],
        ...emptySections,
      });

      expect(txMock.experience.create).toHaveBeenCalledWith({
        data: {
          profileId: 'profile-1',
          company: 'Acme',
          position: 'Engineer',
          positionEs: null,
          positionEn: 'Engineer',
          location: null,
          locationEs: null,
          locationEn: null,
          startDate: null,
          endDate: null,
          current: true,
          description: null,
          descriptionEs: null,
          descriptionEn: null,
          metrics: [],
          metricsEs: [],
          metricsEn: [],
          source: 'USER',
          sortOrder: 1,
        },
      });
    });

    it('persists metrics on experiences and projects, defaulting to empty', async () => {
      txMock.experience.findMany.mockResolvedValue([]);
      txMock.skill.findMany.mockResolvedValue([]);
      txMock.education.findMany.mockResolvedValue([]);
      txMock.certification.findMany.mockResolvedValue([]);
      txMock.project.findMany.mockResolvedValue([]);
      txMock.language.findMany.mockResolvedValue([]);

      await service.replaceForUser('user-1', {
        experiences: [
          {
            company: 'Acme',
            position: 'Engineer',
            current: false,
            metrics: ['Cut latency by 40%'],
            sortOrder: 1,
          },
        ],
        skills: [],
        projects: [
          {
            name: 'Career Analyzer',
            role: 'Owner',
            techStack: ['NestJS'],
            metrics: ['10k users'],
            sortOrder: 1,
          },
          {
            name: 'Project X',
            techStack: [],
            sortOrder: 2,
          },
        ],
        education: [],
        certifications: [],
        languages: [],
      });

      expect(txMock.experience.create).toHaveBeenCalledWith({
        data: {
          profileId: 'profile-1',
          company: 'Acme',
          position: 'Engineer',
          positionEs: null,
          positionEn: 'Engineer',
          location: null,
          locationEs: null,
          locationEn: null,
          startDate: null,
          endDate: null,
          current: false,
          description: null,
          descriptionEs: null,
          descriptionEn: null,
          metrics: ['Cut latency by 40%'],
          metricsEs: [],
          metricsEn: ['Cut latency by 40%'],
          source: 'USER',
          sortOrder: 1,
        },
      });
      expect(txMock.project.create).toHaveBeenCalledWith({
        data: {
          profileId: 'profile-1',
          name: 'Career Analyzer',
          nameEs: null,
          nameEn: 'Career Analyzer',
          role: 'Owner',
          roleEs: null,
          roleEn: 'Owner',
          description: null,
          descriptionEs: null,
          descriptionEn: null,
          url: null,
          techStack: ['NestJS'],
          metrics: ['10k users'],
          metricsEs: [],
          metricsEn: ['10k users'],
          source: 'USER',
          sortOrder: 1,
        },
      });
      expect(txMock.project.create).toHaveBeenCalledWith({
        data: {
          profileId: 'profile-1',
          name: 'Project X',
          nameEs: null,
          nameEn: 'Project X',
          role: null,
          roleEs: null,
          roleEn: null,
          description: null,
          descriptionEs: null,
          descriptionEn: null,
          url: null,
          techStack: [],
          metrics: [],
          metricsEs: [],
          metricsEn: [],
          source: 'USER',
          sortOrder: 2,
        },
      });
    });

    it('never updates ids owned by another profile', async () => {
      txMock.experience.findMany.mockResolvedValue([{ id: 'exp-1' }]);
      txMock.skill.findMany.mockResolvedValue([]);
      txMock.education.findMany.mockResolvedValue([]);
      txMock.certification.findMany.mockResolvedValue([]);
      txMock.project.findMany.mockResolvedValue([]);
      txMock.language.findMany.mockResolvedValue([]);

      await service.replaceForUser('user-1', {
        experiences: [
          {
            id: 'exp-foreign',
            company: 'Hacker',
            position: 'Engineer',
            current: false,
            sortOrder: 1,
          },
        ],
        skills: [],
        ...emptySections,
      });

      expect(txMock.experience.update).not.toHaveBeenCalled();
      expect(txMock.experience.create).toHaveBeenCalledTimes(1);
    });

    it('writes both languages and syncs the flat column when a bilingual object is provided', async () => {
      txMock.experience.findMany.mockResolvedValue([]);
      txMock.skill.findMany.mockResolvedValue([]);
      txMock.education.findMany.mockResolvedValue([]);
      txMock.certification.findMany.mockResolvedValue([]);
      txMock.project.findMany.mockResolvedValue([]);
      txMock.language.findMany.mockResolvedValue([]);

      await service.replaceForUser('user-1', {
        experiences: [
          {
            company: 'Acme',
            position: 'Ingeniero',
            positionI18n: { es: 'Ingeniero', en: 'Engineer' },
            current: false,
            metricsI18n: {
              es: ['Reduje latencia un 40%'],
              en: ['Cut latency by 40%'],
            },
            sortOrder: 1,
          },
        ],
        skills: [],
        ...emptySections,
      });

      expect(txMock.experience.create).toHaveBeenCalledWith({
        data: {
          profileId: 'profile-1',
          company: 'Acme',
          position: 'Ingeniero',
          positionEs: 'Ingeniero',
          positionEn: 'Engineer',
          location: null,
          locationEs: null,
          locationEn: null,
          startDate: null,
          endDate: null,
          current: false,
          description: null,
          descriptionEs: null,
          descriptionEn: null,
          metrics: ['Reduje latencia un 40%'],
          metricsEs: ['Reduje latencia un 40%'],
          metricsEn: ['Cut latency by 40%'],
          source: 'USER',
          sortOrder: 1,
        },
      });
    });

    it('syncs profile-level bilingual fields and flat columns', async () => {
      txMock.experience.findMany.mockResolvedValue([]);
      txMock.skill.findMany.mockResolvedValue([]);
      txMock.education.findMany.mockResolvedValue([]);
      txMock.certification.findMany.mockResolvedValue([]);
      txMock.project.findMany.mockResolvedValue([]);
      txMock.language.findMany.mockResolvedValue([]);

      await service.replaceForUser('user-1', {
        headline: 'Ingeniero de software',
        headlineI18n: { es: 'Ingeniero de software', en: 'Software Engineer' },
        locationI18n: { es: 'Buenos Aires', en: 'Buenos Aires, Argentina' },
        summaryI18n: { es: 'Resumen', en: 'Summary' },
        experiences: [],
        skills: [],
        ...emptySections,
      });

      expect(txMock.profile.update).toHaveBeenCalledWith({
        where: { id: 'profile-1' },
        data: {
          headline: 'Ingeniero de software',
          headlineEs: 'Ingeniero de software',
          headlineEn: 'Software Engineer',
          location: 'Buenos Aires',
          locationEs: 'Buenos Aires',
          locationEn: 'Buenos Aires, Argentina',
          summary: 'Resumen',
          summaryEs: 'Resumen',
          summaryEn: 'Summary',
          phone: null,
          website: null,
          linkedin: null,
          source: 'USER',
        },
        include: profileInclude,
      });
    });
  });

  describe('translateForUser', () => {
    const bilingualProfile = {
      ...profileRow,
      headlineEs: 'Ingeniero de software senior',
      headlineEn: null,
      locationEs: 'Buenos Aires, Argentina',
      locationEn: null,
      summaryEs: 'Especialista backend.',
      summaryEn: null,
      experiences: [
        {
          id: 'exp-1',
          profileId: 'profile-1',
          company: 'Acme',
          position: 'Ingeniero backend',
          positionEs: 'Ingeniero backend',
          positionEn: null,
          location: 'Buenos Aires',
          locationEs: 'Buenos Aires',
          locationEn: null,
          startDate: new Date('2020-01-01'),
          endDate: null,
          current: true,
          description: 'Construí APIs.',
          descriptionEs: 'Construí APIs.',
          descriptionEn: null,
          metrics: ['Reduje latencia un 40%'],
          metricsEs: ['Reduje latencia un 40%'],
          metricsEn: [],
          sortOrder: 0,
          source: 'USER',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      skills: [],
      education: [],
      certifications: [],
      projects: [],
      languages: [],
    };

    it('resuelve el idioma de origen, traduce y fusiona sin persistir', async () => {
      prismaMock.profile.findUnique.mockResolvedValue(bilingualProfile);
      translatorMock.translate.mockResolvedValue({
        profile: {
          headline: 'Senior Software Engineer',
          location: 'Buenos Aires, Argentina',
          summary: 'Backend specialist.',
        },
        experiences: [
          {
            id: 'exp-1',
            position: 'Backend Engineer',
            location: 'Buenos Aires',
            description: 'Built APIs.',
            metrics: ['Reduced latency by 40%'],
          },
        ],
        education: [],
        certifications: [],
        projects: [],
        languages: [],
      });

      const result = await service.translateForUser('user-1', 'en');

      expect(translatorMock.translate).toHaveBeenCalledWith({
        profile: bilingualProfile,
        sourceLang: 'es',
        targetLang: 'en',
      });
      expect(result.headlineEn).toBe('Senior Software Engineer');
      expect(result.headlineEs).toBe('Ingeniero de software senior');
      expect(result.experiences[0].positionEn).toBe('Backend Engineer');
      expect(result.experiences[0].positionEs).toBe('Ingeniero backend');
      expect(result.experiences[0].metricsEn).toEqual([
        'Reduced latency by 40%',
      ]);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('devuelve el perfil sin traducir cuando el origen coincide con el destino', async () => {
      prismaMock.profile.findUnique.mockResolvedValue(bilingualProfile);

      const result = await service.translateForUser('user-1', 'es');

      expect(translatorMock.translate).not.toHaveBeenCalled();
      expect(result).toEqual(bilingualProfile);
    });

    it('usa el idioma de origen explícito (from) en lugar de la heurística', async () => {
      prismaMock.profile.findUnique.mockResolvedValue(bilingualProfile);
      translatorMock.translate.mockResolvedValue({
        profile: {
          headline: 'Senior Software Engineer',
          location: 'Buenos Aires, Argentina',
          summary: 'Backend specialist.',
        },
        experiences: [],
        education: [],
        certifications: [],
        projects: [],
        languages: [],
      });

      await service.translateForUser('user-1', 'en', 'es');

      expect(translatorMock.translate).toHaveBeenCalledWith({
        profile: bilingualProfile,
        sourceLang: 'es',
        targetLang: 'en',
      });
    });
  });
});
