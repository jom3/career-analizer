import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { PhotoCvBar, PhotoCvEntry, PhotoCvModel } from './cv-photo.model';

const PAGE_MARGIN = 40;
const A4_WIDTH = 595.28;
const NAVY = '#1E2A4A';
const TRACK = '#E8E8E8';
const MUTED = '#6B7280';
const SUBTLE = '#B8C2D9';
const BAR_WIDTH = 160;
const PHOTO_BOX: [number, number] = [190, 200];
const SIDEBAR_WIDTH = 170;

export interface PdfPhoto {
  dataUrl: string;
  width: number;
  height: number;
}

export function buildPhotoCvPdfDefinition(
  model: PhotoCvModel,
  photo?: PdfPhoto,
): TDocumentDefinitions {
  return {
    pageMargins: [PAGE_MARGIN, PAGE_MARGIN, PAGE_MARGIN, 30],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#1F2937' },
    images: photo ? { photo: photo.dataUrl } : {},
    content: [
      headerBand(model, photo),
      {
        columns: [
          { width: '*', stack: mainColumn(model) },
          {
            width: SIDEBAR_WIDTH,
            stack: sideColumn(model),
            margin: [24, 0, 0, 0],
          },
        ],
        margin: [0, 24, 0, 0],
      },
    ],
  };
}

function headerBand(model: PhotoCvModel, photo?: PdfPhoto): Content {
  const photoWidth = photo ? photo.width : PHOTO_BOX[0];
  const photoCell: Content = photo
    ? { image: 'photo', width: photo.width, height: photo.height }
    : { text: '' };
  const nameCell: Content = {
    stack: [
      { text: model.name, fontSize: 26, color: '#FFFFFF' },
      model.headline
        ? {
            text: model.headline,
            fontSize: 13,
            color: SUBTLE,
            margin: [0, 2, 0, 8],
          }
        : { text: '' },
      { text: model.contacts.join('   ·   '), fontSize: 9, color: '#FFFFFF' },
    ],
    margin: [24, 40, 24, 24],
  };
  return {
    table: {
      widths: [photoWidth, A4_WIDTH - photoWidth],
      body: [[photoCell, nameCell]],
    },
    margin: [-PAGE_MARGIN, -PAGE_MARGIN, -PAGE_MARGIN, 0],
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
      fillColor: (_row: number, _node: unknown, column: number) =>
        column === 1 ? NAVY : null,
    },
  };
}

function mainColumn(model: PhotoCvModel): Content[] {
  const sections: Content[] = [];
  if (model.summary.length > 0) {
    sections.push(sectionTitle(model.titles.profile));
    sections.push(...model.summary.map(bodyText));
  }
  if (model.education.length > 0) {
    sections.push(sectionTitle(model.titles.education));
    model.education.forEach((entry) => sections.push(...entryBlock(entry)));
  }
  if (model.experiences.length > 0) {
    sections.push(sectionTitle(model.titles.experience));
    model.experiences.forEach((entry) => sections.push(...entryBlock(entry)));
  }
  if (model.certifications.length > 0) {
    sections.push(sectionTitle(model.titles.certifications));
    sections.push({
      ul: model.certifications.map((item) => ({
        text: [
          { text: item.name, bold: true },
          item.issuer ? { text: ` — ${item.issuer}`, color: MUTED } : '',
        ],
      })),
      fontSize: 9.5,
    });
  }
  if (model.achievements.length > 0) {
    sections.push(sectionTitle(model.titles.achievements));
    model.achievements.forEach((entry) => sections.push(...entryBlock(entry)));
  }
  return sections;
}

function sideColumn(model: PhotoCvModel): Content[] {
  const sections: Content[] = [];
  if (model.personal.length > 0) {
    sections.push(sectionTitle(model.titles.personal));
    for (const item of model.personal) {
      sections.push({ text: item.label, color: MUTED, fontSize: 8.5 });
      sections.push({ text: item.value, fontSize: 9.5, margin: [0, 0, 0, 6] });
    }
  }
  if (model.skills.length > 0) {
    sections.push(sectionTitle(model.titles.skills));
    model.skills.forEach((skill) => sections.push(...barBlock(skill)));
  }
  if (model.languages.length > 0) {
    sections.push(sectionTitle(model.titles.languages));
    model.languages.forEach((language) => sections.push(...barBlock(language)));
  }
  return sections;
}

function sectionTitle(text: string): Content {
  return { text, fontSize: 16, margin: [0, 14, 0, 6] };
}

function bodyText(text: string): Content {
  return { text, fontSize: 9.5, margin: [0, 0, 0, 3], lineHeight: 1.2 };
}

function entryBlock(entry: PhotoCvEntry): Content[] {
  const blocks: Content[] = [
    {
      columns: [
        { width: '*', text: entry.title, bold: true, fontSize: 10.5 },
        { width: 'auto', text: entry.meta ?? '', color: MUTED, fontSize: 9 },
      ],
      margin: [0, 6, 0, 0],
    },
  ];
  if (entry.subtitle) {
    blocks.push({ text: entry.subtitle, color: MUTED, fontSize: 9.5 });
  }
  blocks.push(...entry.paragraphs.map(bodyText));
  if (entry.bullets.length > 0) {
    blocks.push({ ul: entry.bullets, fontSize: 9.5, margin: [0, 2, 0, 0] });
  }
  return blocks;
}

function barBlock(bar: PhotoCvBar): Content[] {
  const filled = Math.round(BAR_WIDTH * bar.ratio);
  return [
    { text: bar.label, fontSize: 9.5, margin: [0, 3, 0, 2] },
    {
      canvas: [
        { type: 'rect', x: 0, y: 0, w: BAR_WIDTH, h: 4, r: 2, color: TRACK },
        { type: 'rect', x: 0, y: 0, w: filled, h: 4, r: 2, color: NAVY },
      ],
      margin: [0, 0, 0, 4],
    },
  ];
}
