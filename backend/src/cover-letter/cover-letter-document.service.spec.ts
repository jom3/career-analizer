import * as mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import {
  CoverLetterDocumentService,
  type LetterDocument,
} from './cover-letter-document.service';

describe('CoverLetterDocumentService', () => {
  let service: CoverLetterDocumentService;

  const document: LetterDocument = {
    dateLine: '9 de agosto de 2026',
    subject: 'Re: Senior Software Engineer — Acme',
    content:
      'Estimado equipo de selección,\n\nMe interesa el puesto por mi experiencia en backend.\n\nAtentamente,',
    signature: 'Juan Pérez — juan@test.dev',
    lang: 'es',
  };

  beforeEach(() => {
    service = new CoverLetterDocumentService();
  });

  it('genera un PDF real (texto seleccionable) con las partes de la carta', async () => {
    const buffer = await service.buildLetterPdf(document);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');

    const parsed = new PDFParse({ data: Buffer.from(buffer) });
    try {
      const result = await parsed.getText({ pageJoiner: '\n' });
      expect(result.text).toContain('9 de agosto de 2026');
      expect(result.text).toContain('Re: Senior Software Engineer — Acme');
      expect(result.text).toContain('Estimado equipo de selección,');
      expect(result.text).toContain('Me interesa el puesto');
      expect(result.text).toContain('Atentamente,');
      expect(result.text).toContain('Juan Pérez — juan@test.dev');
    } finally {
      await parsed.destroy();
    }
  });

  it('genera un DOCX nativo con el mismo contenido y los saltos de línea', async () => {
    const buffer = await service.buildLetterDocx(document);
    expect(buffer.subarray(0, 2).toString()).toBe('PK');

    const result = await mammoth.extractRawText({
      buffer: Buffer.from(buffer),
    });
    expect(result.value).toContain('9 de agosto de 2026');
    expect(result.value).toContain('Re: Senior Software Engineer — Acme');
    expect(result.value).toContain('Estimado equipo de selección,');
    expect(result.value).toContain('Me interesa el puesto');
    expect(result.value).toContain('Atentamente,');
    expect(result.value).toContain('Juan Pérez — juan@test.dev');
  });
});
