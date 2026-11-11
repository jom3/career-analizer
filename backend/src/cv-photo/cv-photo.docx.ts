import {
  BorderStyle,
  Document,
  Header,
  ImageRun,
  type ISectionOptions,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  TextRun,
  WidthType,
} from 'docx';
import type { PhotoCvBar, PhotoCvEntry, PhotoCvModel } from './cv-photo.model';

const NAVY = '1E2A4A';
const TRACK = 'E8E8E8';
const MUTED = '6B7280';
const SUBTLE = 'B8C2D9';
const WHITE = 'FFFFFF';

const A4_WIDTH = 11906;
const PHOTO_CELL_WIDTH = 2850;
const TWIPS_PER_PX = 15;
const LEFT_WIDTH = 7300;
const RIGHT_WIDTH = A4_WIDTH - LEFT_WIDTH;
const SIDEBAR_INNER_WIDTH = RIGHT_WIDTH - 284 - 567;
const TEXT_TAB_POSITION = LEFT_WIDTH - 567 - 284;
export const PHOTO_MAX_PX = { width: 190, height: 200 };

export const A4_PAGE = {
  size: { width: A4_WIDTH, height: 16838 },
  margin: { top: 0, right: 0, bottom: 720, left: 0, header: 0, footer: 0 },
};

const CONTINUATION_SPACING_TWIPS = 1000;

export interface DocxPhoto {
  data: Buffer;
  kind: 'jpg' | 'png';
  width: number;
  height: number;
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: WHITE };
const NO_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
};

export function buildPhotoCvDocxChildren(
  model: PhotoCvModel,
  photo?: DocxPhoto,
): (Paragraph | Table)[] {
  return [headerTable(model, photo), bodyTable(model)];
}

export function fitWithin(
  width: number,
  height: number,
  box: { width: number; height: number },
): { width: number; height: number } {
  const scale = Math.min(box.width / width, box.height / height);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

// La primera página va a sangre (franja azul); las siguientes reciben un
// espacio superior mediante el encabezado, porque el margen superior de la
// página es cero.
export function createDocx(
  children: (Paragraph | Table)[],
  additionalSections: ISectionOptions[] = [],
): Document {
  return new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 19 } } } },
    sections: [
      {
        properties: { page: A4_PAGE, titlePage: true },
        headers: {
          default: new Header({
            children: [
              new Paragraph({ spacing: { after: CONTINUATION_SPACING_TWIPS } }),
            ],
          }),
          first: emptyHeader(),
        },
        children,
      },
      ...additionalSections,
    ],
  });
}

export function emptyHeader(): Header {
  return new Header({ children: [new Paragraph({})] });
}

function headerTable(model: PhotoCvModel, photo?: DocxPhoto): Table {
  const photoSize = photo
    ? fitWithin(photo.width, photo.height, PHOTO_MAX_PX)
    : undefined;
  const photoCellWidth = photoSize
    ? photoSize.width * TWIPS_PER_PX
    : PHOTO_CELL_WIDTH;
  const photoParagraphs =
    photo && photoSize
      ? [
          new Paragraph({
            children: [
              new ImageRun({
                type: photo.kind,
                data: photo.data,
                transformation: photoSize,
              }),
            ],
          }),
        ]
      : [emptyParagraph()];

  const nameParagraphs = [
    paragraph(model.name, { size: 52, color: WHITE }),
    ...(model.headline
      ? [paragraph(model.headline, { size: 26, color: SUBTLE, after: 160 })]
      : []),
    paragraph(model.contacts.join('   ·   '), { size: 18, color: WHITE }),
  ];

  return new Table({
    width: { size: A4_WIDTH, type: WidthType.DXA },
    columnWidths: [photoCellWidth, A4_WIDTH - photoCellWidth],
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: photoCellWidth, type: WidthType.DXA },
            borders: NO_BORDERS,
            children: photoParagraphs,
          }),
          new TableCell({
            width: { size: A4_WIDTH - photoCellWidth, type: WidthType.DXA },
            shading: { fill: NAVY, type: ShadingType.CLEAR, color: 'auto' },
            margins: { top: 600, bottom: 400, left: 360, right: 360 },
            borders: NO_BORDERS,
            children: nameParagraphs,
          }),
        ],
      }),
    ],
  });
}

function bodyTable(model: PhotoCvModel): Table {
  return new Table({
    width: { size: A4_WIDTH, type: WidthType.DXA },
    columnWidths: [LEFT_WIDTH, RIGHT_WIDTH],
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: LEFT_WIDTH, type: WidthType.DXA },
            margins: { top: 360, left: 567, right: 284 },
            borders: NO_BORDERS,
            children: withFallback(mainColumn(model)),
          }),
          new TableCell({
            width: { size: RIGHT_WIDTH, type: WidthType.DXA },
            margins: { top: 360, left: 284, right: 567 },
            borders: NO_BORDERS,
            children: withFallback(sideColumn(model)),
          }),
        ],
      }),
    ],
  });
}

function mainColumn(model: PhotoCvModel): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = [];
  if (model.summary.length > 0) {
    children.push(sectionTitle(model.titles.profile));
    children.push(...model.summary.map((line) => bodyParagraph(line)));
  }
  if (model.education.length > 0) {
    children.push(sectionTitle(model.titles.education));
    model.education.forEach((entry) =>
      children.push(...entryParagraphs(entry)),
    );
  }
  if (model.experiences.length > 0) {
    children.push(sectionTitle(model.titles.experience));
    model.experiences.forEach((entry) =>
      children.push(...entryParagraphs(entry)),
    );
  }
  if (model.certifications.length > 0) {
    children.push(sectionTitle(model.titles.certifications));
    model.certifications.forEach((item) =>
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 40 },
          children: [
            new TextRun({ text: item.name, bold: true, size: 19 }),
            ...(item.issuer
              ? [
                  new TextRun({
                    text: ` — ${item.issuer}`,
                    color: MUTED,
                    size: 19,
                  }),
                ]
              : []),
          ],
        }),
      ),
    );
  }
  if (model.achievements.length > 0) {
    children.push(sectionTitle(model.titles.achievements));
    model.achievements.forEach((entry) =>
      children.push(...entryParagraphs(entry)),
    );
  }
  return children;
}

function sideColumn(model: PhotoCvModel): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = [];
  if (model.personal.length > 0) {
    children.push(sectionTitle(model.titles.personal));
    model.personal.forEach((item) => {
      children.push(
        paragraph(item.label, { size: 17, color: MUTED, after: 0 }),
      );
      children.push(paragraph(item.value, { size: 19, after: 120 }));
    });
  }
  if (model.skills.length > 0) {
    children.push(sectionTitle(model.titles.skills));
    model.skills.forEach((skill) => children.push(...barParagraphs(skill)));
  }
  if (model.languages.length > 0) {
    children.push(sectionTitle(model.titles.languages));
    model.languages.forEach((language) =>
      children.push(...barParagraphs(language)),
    );
  }
  return children;
}

function entryParagraphs(entry: PhotoCvEntry): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: TEXT_TAB_POSITION }],
      spacing: { before: 160, after: 0 },
      children: [
        new TextRun({ text: entry.title, bold: true, size: 21 }),
        new TextRun({ text: `\t${entry.meta ?? ''}`, color: MUTED, size: 17 }),
      ],
    }),
  ];
  if (entry.subtitle) {
    children.push(
      paragraph(entry.subtitle, { size: 19, color: MUTED, after: 40 }),
    );
  }
  children.push(...entry.paragraphs.map((line) => bodyParagraph(line)));
  children.push(
    ...entry.bullets.map(
      (metric) =>
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 40 },
          children: [new TextRun({ text: metric, size: 19 })],
        }),
    ),
  );
  return children;
}

function barParagraphs(bar: PhotoCvBar): (Paragraph | Table)[] {
  return [
    paragraph(bar.label, { size: 19, before: 60, after: 40 }),
    barTable(bar.ratio),
  ];
}

function barTable(ratio: number): Table {
  const filled = Math.round(SIDEBAR_INNER_WIDTH * ratio);
  const remaining = SIDEBAR_INNER_WIDTH - filled;
  const segments = [
    { width: filled, fill: NAVY },
    { width: remaining, fill: TRACK },
  ].filter((segment) => segment.width > 0);

  return new Table({
    width: { size: SIDEBAR_INNER_WIDTH, type: WidthType.DXA },
    columnWidths: segments.map((segment) => segment.width),
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    rows: [
      new TableRow({
        children: segments.map(
          (segment) =>
            new TableCell({
              width: { size: segment.width, type: WidthType.DXA },
              shading: {
                fill: segment.fill,
                type: ShadingType.CLEAR,
                color: 'auto',
              },
              borders: NO_BORDERS,
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 0 },
                  children: [new TextRun({ text: '', size: 4 })],
                }),
              ],
            }),
        ),
      }),
    ],
  });
}

function sectionTitle(text: string): Paragraph {
  return paragraph(text, { size: 32, before: 280, after: 120 });
}

function bodyParagraph(text: string): Paragraph {
  return paragraph(text, { size: 19, after: 60 });
}

function paragraph(
  text: string,
  options: {
    size: number;
    color?: string;
    before?: number;
    after?: number;
  },
): Paragraph {
  return new Paragraph({
    spacing: { before: options.before ?? 0, after: options.after ?? 0 },
    children: [new TextRun({ text, size: options.size, color: options.color })],
  });
}

function emptyParagraph(): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: '', size: 2 })] });
}

function withFallback(children: (Paragraph | Table)[]): (Paragraph | Table)[] {
  return children.length > 0 ? children : [emptyParagraph()];
}
