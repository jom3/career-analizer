import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import * as path from 'path';
import { MIME_TYPE_DOCX, MIME_TYPE_PDF } from './text-extractor.service';

export const MAX_CV_FILE_SIZE = 10 * 1024 * 1024;

export const CV_UPLOAD_FIELD = 'file';

// Opciones de Multer para el POST /cv-import: almacena en disco con un
// nombre aleatorio, rechaza mimetypes que no sean PDF/DOCX y limita a 10MB.
export const cvUploadOptions: MulterOptions = {
  storage: diskStorage({
    destination: path.join(process.cwd(), 'uploads'),
    filename: (_req, file, cb) => {
      const extension = file.mimetype === MIME_TYPE_DOCX ? 'docx' : 'pdf';
      cb(null, `${Date.now()}-${randomUUID()}.${extension}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === MIME_TYPE_PDF || file.mimetype === MIME_TYPE_DOCX) {
      cb(null, true);
      return;
    }
    cb(
      new BadRequestException(
        'Formato no soportado. Subí un archivo PDF o DOCX.',
      ),
      false,
    );
  },
  limits: { fileSize: MAX_CV_FILE_SIZE },
};
