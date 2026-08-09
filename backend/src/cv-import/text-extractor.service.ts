import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import * as mammoth from 'mammoth';
import { normalizeText } from './text-normalizer';

export const MIN_EXTRACTED_TEXT_LENGTH = 50;

export const MIME_TYPE_PDF = 'application/pdf';
export const MIME_TYPE_DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export type FileKind = 'pdf' | 'docx';

// Detecta el tipo real de archivo por sus magic bytes en lugar de confiar en
// el mimetype declarado por el cliente, que puede ser impreciso.
export function detectFileType(buffer: Buffer): FileKind | null {
  if (
    buffer.length >= 5 &&
    buffer.subarray(0, 5).toString('latin1') === '%PDF-'
  ) {
    return 'pdf';
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    return 'docx';
  }
  return null;
}

// Extrae el texto plano de un PDF o DOCX y valida que el resultado sea utilizable.
@Injectable()
export class TextExtractorService {
  async extract(buffer: Buffer, mimeType: string): Promise<string> {
    const text =
      mimeType === MIME_TYPE_DOCX
        ? await this.extractDocx(buffer)
        : await this.extractPdf(buffer);

    const normalized = normalizeText(text);
    const trimmed = normalized.trim();
    if (trimmed.length < MIN_EXTRACTED_TEXT_LENGTH) {
      throw new UnprocessableEntityException(
        'No se pudo extraer texto del documento. El archivo puede ser escaneado o no contener texto seleccionable.',
      );
    }
    return trimmed;
  }

  private async extractPdf(buffer: Buffer): Promise<string> {
    const pdf = new PDFParse({ data: buffer });
    try {
      const result = await pdf.getText({ pageJoiner: '\n' });
      return result.text;
    } finally {
      await pdf.destroy();
    }
  }

  private async extractDocx(buffer: Buffer): Promise<string> {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
}
