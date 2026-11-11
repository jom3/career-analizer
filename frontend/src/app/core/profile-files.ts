export const MAX_PROFILE_FILE_BYTES = 10 * 1024 * 1024;

export const PHOTO_ACCEPT = 'image/jpeg,image/png';

export const DOCUMENT_ACCEPT = 'application/pdf,image/jpeg,image/png';

export function isWithinProfileFileLimit(file: File): boolean {
  return file.size <= MAX_PROFILE_FILE_BYTES;
}
