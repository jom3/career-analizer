import { HttpErrorResponse } from '@angular/common/http';

// Códigos que el backend devuelve en el body (`{ code, message }`). El `message`
// queda solo como respaldo; la UI traduce el código.
const API_ERROR_KEYS: Record<string, string> = {
  AI_UNAVAILABLE: 'errors.aiUnavailable',
  INVALID_INPUT: 'errors.invalidInput',
  OFFER_ALREADY_SAVED: 'errors.offerAlreadySaved',
};

export function apiErrorKey(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body = error.error as { code?: unknown } | null;
  const code = typeof body?.code === 'string' ? body.code : null;
  return code ? (API_ERROR_KEYS[code] ?? null) : null;
}

export function httpErrorMessage(error: unknown, fallbackKey: string): string {
  const mapped = apiErrorKey(error);
  if (mapped) {
    return mapped;
  }
  if (error instanceof HttpErrorResponse) {
    if (error.status === 401) {
      return 'errors.invalidCredentials';
    }
    if (error.status === 409) {
      return 'errors.emailTaken';
    }
    if (error.status === 400) {
      return 'errors.badRequest';
    }
  }
  return fallbackKey;
}
