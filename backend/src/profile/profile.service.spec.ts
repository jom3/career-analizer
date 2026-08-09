import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileService, profileInclude } from './profile.service';

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
          location: null,
          startDate: null,
          endDate: null,
          current: false,
          description: null,
          metrics: [],
          source: 'USER',
          sortOrder: 1,
        },
      });
      expect(txMock.experience.create).toHaveBeenCalledWith({
        data: {
          profileId: 'profile-1',
          company: 'Other',
          position: 'Analyst',
          location: null,
          startDate: null,
          endDate: null,
          current: true,
          description: null,
          metrics: [],
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
          location: null,
          startDate: null,
          endDate: null,
          current: true,
          description: null,
          metrics: [],
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
          location: null,
          startDate: null,
          endDate: null,
          current: false,
          description: null,
          metrics: ['Cut latency by 40%'],
          source: 'USER',
          sortOrder: 1,
        },
      });
      expect(txMock.project.create).toHaveBeenCalledWith({
        data: {
          profileId: 'profile-1',
          name: 'Career Analyzer',
          role: 'Owner',
          description: null,
          url: null,
          techStack: ['NestJS'],
          metrics: ['10k users'],
          source: 'USER',
          sortOrder: 1,
        },
      });
      expect(txMock.project.create).toHaveBeenCalledWith({
        data: {
          profileId: 'profile-1',
          name: 'Project X',
          role: null,
          description: null,
          url: null,
          techStack: [],
          metrics: [],
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
  });
});
