import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';

export const PROFILE_FILE_MAX_SIZE = 10 * 1024 * 1024;

export const PROFILE_FILE_FIELD = 'file';

// Se guarda en memoria para validar el contenido antes de escribir en disco.
export const profileFileUploadOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: PROFILE_FILE_MAX_SIZE },
};
