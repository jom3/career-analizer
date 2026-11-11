import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  AlignmentType,
  ImageRun,
  type ISectionOptions,
  PageOrientation,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { imageSize } from 'image-size';
import {
  PDFDocument,
  rgb,
  StandardFonts,
  type PDFEmbeddedPage,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';
import type {
  CvData,
  CvDocument,
  CvLang,
} from '../cv-export/cv-export.service';
import { applyDocumentedVisibility } from '../cv-export/cv-visibility';
import { CvPhotoService, type PhotoImage } from '../cv-photo/cv-photo.service';
import { createDocx, emptyHeader, fitWithin } from '../cv-photo/cv-photo.docx';
import { apiError } from '../common/api-error-codes';
import { ProfileFileStorageService } from '../profile/profile-files/profile-file-storage.service';
import { rasterizePdf } from './pdf-page-rasterizer';

export const MAX_ANNEXES = 30;
export const MAX_ANNEXES_BYTES = 40 * 1024 * 1024;

const A4_PORTRAIT = { width: 595.28, height: 841.89 };
const A4_LANDSCAPE = { width: 841.89, height: 595.28 };
const SHEET_MARGIN = 36;
const DOCX_PORTRAIT = { width: 11906, height: 16838 };
const DOCX_LANDSCAPE = { width: 16838, height: 11906 };
const DOCX_SHEET_MARGIN = 720;
const TWIPS_PER_PX = 15;
const DOCX_HEADER_RESERVE_PX = 150;
const NAVY = rgb(0.118, 0.165, 0.29);
const MUTED = rgb(0.42, 0.447, 0.502);

const SECTION_LABELS: Record<CvLang, string> = {
  es: 'Certificados y títulos',
  en: 'Certificates and degrees',
};

interface AnnexCandidate {
  title: string;
  subtitle?: string;
  document: CvDocument;
}

interface Annex extends AnnexCandidate {
  content: Buffer;
}

interface PdfFonts {
  regular: PDFFont;
  bold: PDFFont;
}

interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DocxSheet {
  annex: Annex;
  kind: 'jpg' | 'png';
  data: Buffer;
  width: number;
  height: number;
}

@Injectable()
export class CvDocumentedService {
  private readonly logger = new Logger(CvDocumentedService.name);

  constructor(
    private readonly cvPhotoService: CvPhotoService,
    private readonly fileStorage: ProfileFileStorageService,
  ) {}

  async buildPdf(
    data: CvData,
    lang: CvLang,
    photo?: PhotoImage,
  ): Promise<Buffer> {
    const annexes = await this.loadAnnexes(data);
    const cvPdf = await this.cvPhotoService.buildPdf(
      applyDocumentedVisibility(data),
      lang,
      photo,
    );
    const output = await PDFDocument.load(cvPdf);
    const fonts = {
      regular: await output.embedFont(StandardFonts.Helvetica),
      bold: await output.embedFont(StandardFonts.HelveticaBold),
    };
    for (const annex of annexes) {
      await appendPdfAnnex(output, annex, fonts, SECTION_LABELS[lang]);
    }
    return Buffer.from(await output.save());
  }

  async buildDocx(
    data: CvData,
    lang: CvLang,
    photo?: PhotoImage,
  ): Promise<Buffer> {
    const annexes = await this.loadAnnexes(data);
    const children = this.cvPhotoService.buildDocxChildren(
      applyDocumentedVisibility(data),
      lang,
      photo,
    );
    const annexSections: ISectionOptions[] = [];
    for (const annex of annexes) {
      for (const sheet of await docxSheets(annex)) {
        annexSections.push(docxAnnexSection(sheet, SECTION_LABELS[lang]));
      }
    }
    return Packer.toBuffer(createDocx(children, annexSections));
  }

  private async loadAnnexes(data: CvData): Promise<Annex[]> {
    const candidates = documentedAnnexCandidates(data);
    if (candidates.length > MAX_ANNEXES) {
      throw new BadRequestException(
        apiError(
          'TOO_MANY_ANNEXES',
          `El CV documentado admite hasta ${MAX_ANNEXES} anexos y el perfil tiene ${candidates.length}.`,
        ),
      );
    }
    const loaded = await Promise.all(
      candidates.map(async (candidate) => ({
        ...candidate,
        content: await this.fileStorage.readOrNull(candidate.document.path),
      })),
    );
    // Un adjunto borrado del disco se omite: el CV se genera igual.
    const annexes: Annex[] = loaded
      .filter((annex) => annex.content !== null)
      .map((annex) => ({ ...annex, content: annex.content as Buffer }));
    const skipped = loaded.length - annexes.length;
    if (skipped > 0) {
      this.logger.warn(
        `${skipped} adjunto(s) no encontrados en disco y omitidos del CV documentado.`,
      );
    }
    const totalBytes = annexes.reduce(
      (sum, annex) => sum + annex.content.length,
      0,
    );
    if (totalBytes > MAX_ANNEXES_BYTES) {
      throw new BadRequestException(
        apiError(
          'ANNEXES_TOO_LARGE',
          'Los anexos superan el límite de 40 MB por documento.',
        ),
      );
    }
    return annexes;
  }
}

function documentedAnnexCandidates(data: CvData): AnnexCandidate[] {
  const education = data.education.flatMap((item) =>
    item.document && item.showInDocumentedCv !== false
      ? [
          {
            title: item.degree,
            subtitle: item.institution,
            document: item.document,
          },
        ]
      : [],
  );
  const certifications = data.certifications.flatMap((item) =>
    item.document && item.showInDocumentedCv !== false
      ? [
          {
            title: item.name,
            subtitle:
              [item.issuer, item.year].filter(Boolean).join(' · ') || undefined,
            document: item.document,
          },
        ]
      : [],
  );
  return [...education, ...certifications];
}

async function appendPdfAnnex(
  output: PDFDocument,
  annex: Annex,
  fonts: PdfFonts,
  label: string,
): Promise<void> {
  if (annex.document.mimeType === 'application/pdf') {
    const source = await PDFDocument.load(annex.content);
    const pages = await output.embedPages(source.getPages());
    for (const page of pages) {
      drawEmbeddedPageSheet(output, page, annex, fonts, label);
    }
    return;
  }

  const image =
    annex.document.mimeType === 'image/png'
      ? await output.embedPng(annex.content)
      : await output.embedJpg(annex.content);
  drawImageSheet(output, image, annex, fonts, label);
}

function drawEmbeddedPageSheet(
  output: PDFDocument,
  embedded: PDFEmbeddedPage,
  annex: Annex,
  fonts: PdfFonts,
  label: string,
): void {
  const page = addSheetPage(output, embedded.width, embedded.height);
  const area = drawSheetHeader(page, annex, fonts, label);
  const scale = fitScale(embedded.width, embedded.height, area);
  const width = embedded.width * scale;
  const height = embedded.height * scale;
  page.drawPage(embedded, {
    x: area.x + (area.width - width) / 2,
    y: area.y + (area.height - height) / 2,
    xScale: scale,
    yScale: scale,
  });
}

function drawImageSheet(
  output: PDFDocument,
  image: PDFImage,
  annex: Annex,
  fonts: PdfFonts,
  label: string,
): void {
  const page = addSheetPage(output, image.width, image.height);
  const area = drawSheetHeader(page, annex, fonts, label);
  const scale = fitScale(image.width, image.height, area);
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, {
    x: area.x + (area.width - width) / 2,
    y: area.y + (area.height - height) / 2,
    width,
    height,
  });
}

function addSheetPage(
  output: PDFDocument,
  width: number,
  height: number,
): PDFPage {
  const size = width > height ? A4_LANDSCAPE : A4_PORTRAIT;
  return output.addPage([size.width, size.height]);
}

function drawSheetHeader(
  page: PDFPage,
  annex: Annex,
  fonts: PdfFonts,
  label: string,
): Area {
  const textWidth = page.getWidth() - SHEET_MARGIN * 2;
  let cursor = page.getHeight() - SHEET_MARGIN - 9;
  page.drawText(label, {
    x: SHEET_MARGIN,
    y: cursor,
    size: 9,
    font: fonts.regular,
    color: MUTED,
  });
  cursor -= 16;

  for (const line of wrapText(
    toStandardFontText(annex.title),
    fonts.bold,
    18,
    textWidth,
  )) {
    cursor -= 24;
    page.drawText(line, {
      x: SHEET_MARGIN,
      y: cursor,
      size: 18,
      font: fonts.bold,
      color: NAVY,
    });
  }

  if (annex.subtitle) {
    for (const line of wrapText(
      toStandardFontText(annex.subtitle),
      fonts.regular,
      11,
      textWidth,
    )) {
      cursor -= 16;
      page.drawText(line, {
        x: SHEET_MARGIN,
        y: cursor,
        size: 11,
        font: fonts.regular,
        color: MUTED,
      });
    }
  }

  const contentTop = cursor - 12;
  return {
    x: SHEET_MARGIN,
    y: SHEET_MARGIN,
    width: textWidth,
    height: contentTop - SHEET_MARGIN,
  };
}

function fitScale(width: number, height: number, area: Area): number {
  return Math.min(area.width / width, area.height / height);
}

async function docxSheets(annex: Annex): Promise<DocxSheet[]> {
  if (annex.document.mimeType === 'application/pdf') {
    const pages = await rasterizePdf(annex.content);
    return pages.map((page) => ({
      annex,
      kind: 'jpg',
      data: page.data,
      width: page.width,
      height: page.height,
    }));
  }
  const { width, height } = imageSize(annex.content);
  return [
    {
      annex,
      kind: annex.document.mimeType === 'image/png' ? 'png' : 'jpg',
      data: annex.content,
      width: width ?? 1,
      height: height ?? 1,
    },
  ];
}

function docxAnnexSection(sheet: DocxSheet, label: string): ISectionOptions {
  const landscape = sheet.width > sheet.height;
  return {
    properties: {
      page: {
        size: {
          width: DOCX_PORTRAIT.width,
          height: DOCX_PORTRAIT.height,
          orientation: landscape
            ? PageOrientation.LANDSCAPE
            : PageOrientation.PORTRAIT,
        },
        margin: {
          top: DOCX_SHEET_MARGIN,
          bottom: DOCX_SHEET_MARGIN,
          left: DOCX_SHEET_MARGIN,
          right: DOCX_SHEET_MARGIN,
          header: 0,
          footer: 0,
        },
      },
    },
    headers: { default: emptyHeader(), first: emptyHeader() },
    children: docxSheetParagraphs(sheet, label),
  };
}

function docxSheetParagraphs(sheet: DocxSheet, label: string): Paragraph[] {
  const page = sheet.width > sheet.height ? DOCX_LANDSCAPE : DOCX_PORTRAIT;
  const imageSizePx = fitWithin(sheet.width, sheet.height, {
    width: (page.width - DOCX_SHEET_MARGIN * 2) / TWIPS_PER_PX,
    height:
      (page.height - DOCX_SHEET_MARGIN * 2) / TWIPS_PER_PX -
      DOCX_HEADER_RESERVE_PX,
  });

  const paragraphs = [
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: label, color: '6B7280', size: 18 })],
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: sheet.annex.title,
          bold: true,
          color: '1E2A4A',
          size: 32,
        }),
      ],
    }),
  ];
  if (sheet.annex.subtitle) {
    paragraphs.push(
      new Paragraph({
        spacing: { after: 160 },
        children: [
          new TextRun({
            text: sheet.annex.subtitle,
            color: '6B7280',
            size: 22,
          }),
        ],
      }),
    );
  }
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new ImageRun({
          type: sheet.kind,
          data: sheet.data,
          transformation: imageSizePx,
        }),
      ],
    }),
  );
  return paragraphs;
}

function toStandardFontText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '?')
    .trim();
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}
