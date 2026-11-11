import { BadRequestException } from '@nestjs/common';
import { imageSize } from 'image-size';
import { PDFDocument } from 'pdf-lib';
import { detectProfileFileKind, type ProfileFileKind } from './file-signature';

export async function validateProfileFile(
  buffer: Buffer,
  allowedKinds: ProfileFileKind[],
): Promise<ProfileFileKind> {
  const kind = detectProfileFileKind(buffer);
  if (!kind || !allowedKinds.includes(kind)) {
    throw new BadRequestException(
      `Formato no soportado. Formatos permitidos: ${allowedKinds.join(', ')}.`,
    );
  }
  if (!(await isReadable(buffer, kind))) {
    throw new BadRequestException(
      'El archivo está dañado, cifrado o no se puede leer.',
    );
  }
  return kind;
}

async function isReadable(
  buffer: Buffer,
  kind: ProfileFileKind,
): Promise<boolean> {
  try {
    if (kind === 'pdf') {
      const document = await PDFDocument.load(buffer);
      return document.getPageCount() > 0;
    }
    const { width, height } = imageSize(buffer);
    return Boolean(width && height);
  } catch {
    return false;
  }
}
