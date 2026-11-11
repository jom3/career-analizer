import { BadRequestException } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import type { CvData } from '../cv-export/cv-export.service';
import { ProfileFileStorageService } from '../profile/profile-files/profile-file-storage.service';
import { CvPhotoService } from '../cv-photo/cv-photo.service';
import { CvDocumentedService, MAX_ANNEXES } from './cv-documented.service';

async function buildPdfWithPages(
  pageCount: number,
  size: [number, number] = [612, 792],
): Promise<Buffer> {
  const document = await PDFDocument.create();
  for (let index = 0; index < pageCount; index++) {
    const page = document.addPage(size);
    page.drawRectangle({ x: 20, y: 20, width: 100, height: 100 });
  }
  return Buffer.from(await document.save());
}

function documentedItem(index: number, showInDocumentedCv = true) {
  return {
    name: `Certificado ${index}`,
    showInDocumentedCv,
    document: {
      path: `uploads/profile/${index}.pdf`,
      mimeType: 'application/pdf',
      name: `${index}.pdf`,
    },
  };
}

function buildData(certifications: CvData['certifications']): CvData {
  return {
    name: 'Ana',
    email: 'ana@example.com',
    experiences: [],
    skills: [],
    education: [],
    certifications,
    projects: [],
    languages: [],
  };
}

describe('CvDocumentedService', () => {
  let service: CvDocumentedService;
  let storage: { readOrNull: jest.Mock };
  let cvPhoto: { buildPdf: jest.Mock; buildDocxChildren: jest.Mock };

  beforeEach(async () => {
    storage = {
      readOrNull: jest.fn().mockResolvedValue(await buildPdfWithPages(2)),
    };
    cvPhoto = {
      buildPdf: jest.fn().mockResolvedValue(await buildPdfWithPages(1)),
      buildDocxChildren: jest.fn().mockReturnValue([]),
    };
    service = new CvDocumentedService(
      cvPhoto as unknown as CvPhotoService,
      storage as unknown as ProfileFileStorageService,
    );
  });

  it('adds one sheet per page of each documented item, without separator pages', async () => {
    const data = buildData([
      documentedItem(1),
      documentedItem(2, false),
    ] as CvData['certifications']);

    const pdf = await service.buildPdf(data, 'es');
    const output = await PDFDocument.load(pdf);

    expect(storage.readOrNull).toHaveBeenCalledTimes(1);
    expect(storage.readOrNull).toHaveBeenCalledWith('uploads/profile/1.pdf');
    expect(output.getPageCount()).toBe(1 + 2);
  });

  it('builds the document with eleven attachments', async () => {
    const items = Array.from({ length: 11 }, (_, index) =>
      documentedItem(index),
    ) as CvData['certifications'];

    const output = await PDFDocument.load(
      await service.buildPdf(buildData(items), 'es'),
    );

    expect(output.getPageCount()).toBe(1 + 11 * 2);
  });

  it('skips an attachment whose file is missing instead of failing', async () => {
    storage.readOrNull.mockResolvedValue(null);
    const data = buildData([documentedItem(1)] as CvData['certifications']);

    const output = await PDFDocument.load(await service.buildPdf(data, 'es'));

    expect(output.getPageCount()).toBe(1);
  });

  it('places a horizontal document on a landscape sheet', async () => {
    storage.readOrNull.mockResolvedValue(
      await buildPdfWithPages(1, [800, 500]),
    );
    const data = buildData([documentedItem(1)] as CvData['certifications']);

    const output = await PDFDocument.load(await service.buildPdf(data, 'es'));
    const sheet = output.getPage(output.getPageCount() - 1);

    expect(sheet.getWidth()).toBeGreaterThan(sheet.getHeight());
  });

  it('rejects more annexes than the allowed maximum', async () => {
    const items = Array.from({ length: MAX_ANNEXES + 1 }, (_, index) =>
      documentedItem(index),
    ) as CvData['certifications'];

    const error = await service
      .buildPdf(buildData(items), 'es')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BadRequestException);
    const body = (error as BadRequestException).getResponse() as {
      code?: string;
    };
    expect(body.code).toBe('TOO_MANY_ANNEXES');
    expect(storage.readOrNull).not.toHaveBeenCalled();
  });
});
