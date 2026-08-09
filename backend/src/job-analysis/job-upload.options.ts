import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';

export const MAX_JOB_FILE_SIZE = 10 * 1024 * 1024;

export const JOB_UPLOAD_FIELD = 'file';

// Opciones de Multer para POST /job-analysis/analyze: se usa memoryStorage
// porque la imagen o el PDF solo impulsan el análisis y nunca se persisten.
export const jobUploadOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_JOB_FILE_SIZE },
};
