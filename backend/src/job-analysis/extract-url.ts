const URL_PATTERN = /https?:\/\/[^\s<>"'`)\]]+/i;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;
const MAX_URL_LENGTH = 2048;

export function extractFirstUrl(text: string): string | null {
  const match = URL_PATTERN.exec(text);
  if (!match) {
    return null;
  }
  const url = match[0].replace(TRAILING_PUNCTUATION, '');
  return url.length <= MAX_URL_LENGTH ? url : null;
}
