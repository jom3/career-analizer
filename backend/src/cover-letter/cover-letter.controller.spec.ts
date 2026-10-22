import type { RequestWithUser } from '../auth/request-with-user';
import { CoverLetterController } from './cover-letter.controller';
import type { CoverLetterService } from './cover-letter.service';

describe('CoverLetterController — idioma del documento', () => {
  const serviceMock = {
    buildDraft: jest.fn(),
    create: jest.fn(),
  };

  const request = (uiLang?: 'es' | 'en') =>
    ({ user: { id: 'user-1' }, uiLang }) as unknown as RequestWithUser;

  let controller: CoverLetterController;

  beforeEach(() => {
    jest.clearAllMocks();
    serviceMock.buildDraft.mockResolvedValue({});
    serviceMock.create.mockResolvedValue({});
    controller = new CoverLetterController(
      serviceMock as unknown as CoverLetterService,
    );
  });

  it('usa el lang explícito por encima de Accept-Language', async () => {
    await controller.buildDraft(request('es'), {
      jobOfferId: 'offer-1',
      lang: 'en',
    });

    expect(serviceMock.buildDraft).toHaveBeenCalledWith(
      'user-1',
      'offer-1',
      null,
      null,
      'en',
    );
  });

  it('cae al idioma de la interfaz cuando no hay lang', async () => {
    await controller.buildDraft(request('en'), { jobOfferId: 'offer-1' });

    expect(serviceMock.buildDraft).toHaveBeenCalledWith(
      'user-1',
      'offer-1',
      null,
      null,
      'en',
    );
  });

  it('cae a español cuando no hay lang ni Accept-Language', async () => {
    await controller.buildDraft(request(), { jobOfferId: 'offer-1' });

    expect(serviceMock.buildDraft).toHaveBeenCalledWith(
      'user-1',
      'offer-1',
      null,
      null,
      'es',
    );
  });
});
