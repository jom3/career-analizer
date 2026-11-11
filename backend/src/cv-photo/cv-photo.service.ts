import { Injectable } from '@nestjs/common';
import { Packer, Paragraph, Table } from 'docx';
import { imageSize } from 'image-size';
import type { CvData, CvLang } from '../cv-export/cv-export.service';
import { renderPdf } from '../cv-export/pdf-engine';
import { ProfileFileStorageService } from '../profile/profile-files/profile-file-storage.service';
import {
  buildPhotoCvDocxChildren,
  createDocx,
  fitWithin,
  PHOTO_MAX_PX,
  type DocxPhoto,
} from './cv-photo.docx';
import { buildPhotoCvModel } from './cv-photo.model';
import { buildPhotoCvPdfDefinition, type PdfPhoto } from './cv-photo.pdf';

export interface PhotoImage {
  buffer: Buffer;
  mimeType: string;
}

@Injectable()
export class CvPhotoService {
  constructor(private readonly fileStorage: ProfileFileStorageService) {}

  // Si el archivo de la foto ya no existe, el CV se genera sin foto en lugar
  // de fallar la descarga.
  async readPhoto(data: CvData): Promise<PhotoImage | undefined> {
    if (!data.photo) {
      return undefined;
    }
    const buffer = await this.fileStorage.readOrNull(data.photo.path);
    if (!buffer) {
      return undefined;
    }
    return { buffer, mimeType: data.photo.mimeType };
  }

  buildPdf(data: CvData, lang: CvLang, photo?: PhotoImage): Promise<Buffer> {
    const model = buildPhotoCvModel(data, lang);
    const pdfPhoto = photo ? toPdfPhoto(photo) : undefined;
    return renderPdf(buildPhotoCvPdfDefinition(model, pdfPhoto));
  }

  buildDocxChildren(
    data: CvData,
    lang: CvLang,
    photo?: PhotoImage,
  ): (Paragraph | Table)[] {
    const model = buildPhotoCvModel(data, lang);
    return buildPhotoCvDocxChildren(
      model,
      photo ? toDocxPhoto(photo) : undefined,
    );
  }

  buildDocx(data: CvData, lang: CvLang, photo?: PhotoImage): Promise<Buffer> {
    return Packer.toBuffer(
      createDocx(this.buildDocxChildren(data, lang, photo)),
    );
  }
}

function toPdfPhoto(photo: PhotoImage): PdfPhoto {
  const { width, height } = imageSize(photo.buffer);
  const fitted = fitWithin(width ?? 1, height ?? 1, PHOTO_MAX_PX);
  return {
    dataUrl: `data:${photo.mimeType};base64,${photo.buffer.toString('base64')}`,
    width: fitted.width,
    height: fitted.height,
  };
}

function toDocxPhoto(photo: PhotoImage): DocxPhoto {
  const { width, height } = imageSize(photo.buffer);
  return {
    data: photo.buffer,
    kind: photo.mimeType === 'image/png' ? 'png' : 'jpg',
    width: width ?? 1,
    height: height ?? 1,
  };
}
