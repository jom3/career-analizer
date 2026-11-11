import { BadRequestException } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import { detectProfileFileKind } from './file-signature';
import { validateProfileFile } from './profile-file-validator';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const JPG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

async function buildPdf(): Promise<Buffer> {
  const document = await PDFDocument.create();
  document.addPage();
  return Buffer.from(await document.save());
}

describe('detectProfileFileKind', () => {
  it('detects PNG, JPG and PDF by their signatures', async () => {
    expect(detectProfileFileKind(PNG_1X1)).toBe('png');
    expect(detectProfileFileKind(JPG_HEADER)).toBe('jpg');
    expect(detectProfileFileKind(await buildPdf())).toBe('pdf');
  });

  it('returns null for unknown content', () => {
    expect(detectProfileFileKind(Buffer.from('plain text'))).toBeNull();
  });
});

describe('validateProfileFile', () => {
  it('accepts a PNG photo', async () => {
    await expect(validateProfileFile(PNG_1X1, ['jpg', 'png'])).resolves.toBe(
      'png',
    );
  });

  it('rejects a kind that is not allowed', async () => {
    await expect(
      validateProfileFile(await buildPdf(), ['jpg', 'png']),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a corrupted PDF', async () => {
    const corrupted = Buffer.from('%PDF-1.4 not really a document');
    await expect(validateProfileFile(corrupted, ['pdf'])).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects an unreadable image', async () => {
    await expect(validateProfileFile(JPG_HEADER, ['jpg'])).rejects.toThrow(
      BadRequestException,
    );
  });
});
