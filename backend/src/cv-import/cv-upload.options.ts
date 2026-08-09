import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import * as path from 'path';
import { MIME_TYPE_DOCX, MIME_TYPE_PDF } from './text-extractor.service';

export const MAX_CV_FILE_SIZE = 10 * 1024 * 1024;

export const CV_UPLOAD_FIELD = 'file';

// Opciones de Multer para el POST /cv-import: almacena en disco con un nombre
// aleatorio y limita el tamaño a 10MB. El tipo real del archivo (PDF/DOCX) se
// valida en CvImportService leyendo sus magic bytes, porque el mimetype que
// declara el cliente puede ser impreciso.
export const cvUploadOptions: MulterOptions = {
  storage: diskStorage({
    destination: path.join(process.cwd(), 'uploads'),
    filename: (_req, file, cb) => {
      const extension =
        file.mimetype === MIME_TYPE_PDF
          ? 'pdf'
          : file.mimetype === MIME_TYPE_DOCX
            ? 'docx'
            : 'bin';
      cb(null, `${Date.now()}-${randomUUID()}.${extension}`);
    },
  }),
  limits: { fileSize: MAX_CV_FILE_SIZE },
};
