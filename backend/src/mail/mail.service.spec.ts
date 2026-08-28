import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';

describe('MailService', () => {
  let service: MailService;
  let warnSpy: jest.SpyInstance<void, [unknown]>;

  const configMock = { get: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('with MAIL_DRIVER=log', () => {
    it('logs the reset link and does not attempt to send', async () => {
      configMock.get.mockImplementation((key: string) => {
        if (key === 'MAIL_DRIVER') return 'log';
        return undefined;
      });

      await service.sendPasswordReset(
        'ana@test.dev',
        'http://localhost:4200/auth/reset-password?token=x',
      );

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const message = String(warnSpy.mock.calls[0][0]);
      expect(message).toContain('ana@test.dev');
      expect(message).toContain('reset-password?token=x');
    });
  });

  describe('with MAIL_DRIVER=smtp but missing credentials', () => {
    it('falls back to logging the link', async () => {
      configMock.get.mockImplementation((key: string) => {
        if (key === 'MAIL_DRIVER') return 'smtp';
        if (key === 'SMTP_HOST') return '';
        return undefined;
      });

      await service.sendPasswordReset(
        'ana@test.dev',
        'http://localhost:4200/auth/reset-password?token=x',
      );

      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
  });
});
