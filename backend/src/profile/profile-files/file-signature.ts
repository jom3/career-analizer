export type ProfileFileKind = 'jpg' | 'png' | 'pdf';

export const PHOTO_FILE_KINDS: ProfileFileKind[] = ['jpg', 'png'];
export const DOCUMENT_FILE_KINDS: ProfileFileKind[] = ['pdf', 'jpg', 'png'];

export const PROFILE_MIME_BY_KIND: Record<ProfileFileKind, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
};

const JPG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function detectProfileFileKind(buffer: Buffer): ProfileFileKind | null {
  if (startsWithBytes(buffer, JPG_SIGNATURE)) {
    return 'jpg';
  }
  if (startsWithBytes(buffer, PNG_SIGNATURE)) {
    return 'png';
  }
  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
    return 'pdf';
  }
  return null;
}

function startsWithBytes(buffer: Buffer, signature: number[]): boolean {
  return (
    buffer.length >= signature.length &&
    signature.every((byte, index) => buffer[index] === byte)
  );
}
