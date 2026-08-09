import { UnprocessableEntityException } from '@nestjs/common';
import { readFileSync } from 'fs';
import * as path from 'path';
import {
  detectFileType,
  MIME_TYPE_DOCX,
  MIME_TYPE_PDF,
  TextExtractorService,
} from './text-extractor.service';

describe('detectFileType', () => {
  it('detecta un PDF por su cabecera %PDF-', () => {
    expect(detectFileType(Buffer.from('%PDF-1.7\n...'))).toBe('pdf');
  });

  it('detecta un DOCX por su firma ZIP PK', () => {
    expect(
      detectFileType(
        Buffer.concat([
          Buffer.from([0x50, 0x4b, 0x03, 0x04]),
          Buffer.from('zip content'),
        ]),
      ),
    ).toBe('docx');
  });

  it('devuelve null para contenido que no es PDF ni DOCX', () => {
    expect(detectFileType(Buffer.from('plain text'))).toBeNull();
    expect(detectFileType(Buffer.from(''))).toBeNull();
    expect(detectFileType(Buffer.from('%PDF'))).toBeNull();
  });
});

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

  it('normaliza el texto extraído (sin ligaduras ni espacios múltiples)', async () => {
    const buffer = readFileSync(path.join(fixturesDir, 'sample.pdf'));
    const text = await service.extract(buffer, MIME_TYPE_PDF);
    expect(text).not.toMatch(/[\uFB00-\uFB06\u00A0\u2007\u202F]/);
    expect(text).not.toMatch(/[ \t]{2,}/);
  });

  it('normaliza un PDF cuyo contenido codifica ligaduras', async () => {
    const buffer = readFileSync(path.join(fixturesDir, 'ligatures.pdf'));
    const text = await service.extract(buffer, MIME_TYPE_PDF);
    expect(text).not.toMatch(/[\uFB00-\uFB06]/);
    expect(text).toContain('file');
    expect(text).toContain('office');
    expect(text).toContain('flow');
    expect(text).toContain('start');
  });

  it('normaliza un DOCX cuyas ligaduras llegan crudas desde mammoth', async () => {
    const buffer = readFileSync(path.join(fixturesDir, 'ligatures.docx'));
    const text = await service.extract(buffer, MIME_TYPE_DOCX);
    expect(text).not.toMatch(/[\uFB00-\uFB06]/);
    expect(text).toContain('file office efficient style');
  });
});
