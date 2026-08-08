import { UnprocessableEntityException } from '@nestjs/common';
import { readFileSync } from 'fs';
import * as path from 'path';
import {
  MIME_TYPE_DOCX,
  MIME_TYPE_PDF,
  TextExtractorService,
} from './text-extractor.service';

describe('TextExtractorService', () => {
  let service: TextExtractorService;
  const fixturesDir = path.join(__dirname, '..', '..', 'test', 'fixtures');

  beforeEach(() => {
    service = new TextExtractorService();
  });

  it('extrae texto de un PDF', async () => {
    const buffer = readFileSync(path.join(fixturesDir, 'sample.pdf'));
    const text = await service.extract(buffer, MIME_TYPE_PDF);
    expect(text).toContain('Senior Developer');
  });

  it('extrae texto de un DOCX', async () => {
    const buffer = readFileSync(path.join(fixturesDir, 'sample.docx'));
    const text = await service.extract(buffer, MIME_TYPE_DOCX);
    expect(text).toContain('Senior Developer');
  });

  it('lanza 422 cuando el texto extraído es muy corto (PDF escaneado)', async () => {
    const buffer = readFileSync(path.join(fixturesDir, 'scanned.pdf'));
    await expect(service.extract(buffer, MIME_TYPE_PDF)).rejects.toThrow(
      UnprocessableEntityException,
    );
  });
});
