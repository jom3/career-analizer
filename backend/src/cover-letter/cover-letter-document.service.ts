import { Injectable } from '@nestjs/common';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import pdfMake from 'pdfmake';
import vfsFonts from 'pdfmake/build/vfs_fonts';
import { Content, TCreatedPdf, TDocumentDefinitions } from 'pdfmake/interfaces';

export type LetterLang = 'es' | 'en';

export interface LetterDocument {
  dateLine: string;
  subject: string;
  content: string;
  signature: string;
  lang: LetterLang;
}

const robotoFonts = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
};

interface PdfMakeServer {
  virtualfs: {
    existsSync(path: string): boolean;
    writeFileSync(path: string, content: string, encoding: string): void;
  };
  setFonts(fonts: Record<string, unknown>): void;
  createPdf(doc: TDocumentDefinitions): TCreatedPdf;
}

const pdfMakeServer = pdfMake as unknown as PdfMakeServer;

let fontsLoaded = false;

function ensureFonts(): void {
  if (fontsLoaded) {
    return;
  }
  for (const [name, content] of Object.entries(vfsFonts)) {
    pdfMakeServer.virtualfs.writeFileSync(name, content, 'base64');
  }
  pdfMakeServer.setFonts(robotoFonts);
  fontsLoaded = true;
}

// Genera el documento de la carta de motivación (formato carta A4, una columna)
// con pdfmake (PDF con texto real) y docx (DOCX nativo). La fecha, el asunto y
// la firma llegan calculados por el service; acá solo se renderizan con la
// maquetación de carta y el texto del content preservando los saltos de línea.
@Injectable()
export class CoverLetterDocumentService {
  async buildLetterPdf(doc: LetterDocument): Promise<Buffer> {
    ensureFonts();
    const document: TDocumentDefinitions = {
      pageSize: 'A4',
      pageMargins: [64, 64, 64, 64],
      content: this.buildPdfContent(doc),
      defaultStyle: { font: 'Roboto', fontSize: 11 },
      styles: {
        dateLine: { fontSize: 11, alignment: 'right', margin: [0, 0, 0, 16] },
        subject: { fontSize: 12, bold: true, margin: [0, 0, 0, 16] },
        paragraph: { fontSize: 11, margin: [0, 0, 0, 12] },
        signature: { fontSize: 11, margin: [0, 32, 0, 0] },
      },
    };
    return await pdfMakeServer.createPdf(document).getBuffer();
  }

  async buildLetterDocx(doc: LetterDocument): Promise<Buffer> {
    const document = new Document({
      sections: [{ children: this.buildDocxContent(doc) }],
    });
    return Packer.toBuffer(document);
  }

  private buildPdfContent(doc: LetterDocument): Content[] {
    const content: Content[] = [
      { text: doc.dateLine, style: 'dateLine' },
      { text: doc.subject, style: 'subject' },
    ];
    for (const line of this.nonEmptyLines(doc.content)) {
      content.push({ text: line, style: 'paragraph' });
    }
    content.push({ text: doc.signature, style: 'signature' });
    return content;
  }

  private buildDocxContent(doc: LetterDocument): Paragraph[] {
    const children: Paragraph[] = [
      new Paragraph({
        children: [new TextRun({ text: doc.dateLine, size: 22 })],
        alignment: 'right',
        spacing: { after: 240 },
      }),
      new Paragraph({
        children: [new TextRun({ text: doc.subject, bold: true, size: 24 })],
        spacing: { after: 240 },
      }),
    ];
    for (const line of this.nonEmptyLines(doc.content)) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line, size: 22 })],
          spacing: { after: 120 },
        }),
      );
    }
    children.push(
      new Paragraph({
        children: [new TextRun({ text: doc.signature, size: 22 })],
        spacing: { before: 240 },
      }),
    );
    return children;
  }

  private nonEmptyLines(text: string): string[] {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }
}
