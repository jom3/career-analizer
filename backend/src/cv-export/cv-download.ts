import { StreamableFile } from '@nestjs/common';

export type CvFormat = 'pdf' | 'docx';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function toCvDownload(
  format: CvFormat,
  buffer: Buffer,
  fileBaseName: string,
): StreamableFile {
  const isPdf = format === 'pdf';
  return new StreamableFile(buffer, {
    type: isPdf ? 'application/pdf' : DOCX_MIME,
    disposition: `attachment; filename="${fileBaseName}.${format}"`,
  });
}

export function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_-]/g, '-') || 'cv';
}
