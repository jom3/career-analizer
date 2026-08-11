import { HttpErrorResponse } from '@angular/common/http';

export function httpErrorMessage(error: unknown, fallbackKey: string): string {
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