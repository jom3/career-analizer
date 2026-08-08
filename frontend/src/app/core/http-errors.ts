import { HttpErrorResponse } from '@angular/common/http';

export function httpErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 401) {
      return 'Email o contraseña incorrectos';
    }
    if (error.status === 409) {
      return 'Ya existe una cuenta con ese email';
    }
    if (error.status === 400) {
      return 'Revisa los datos ingresados';
    }
  }
  return fallback;
}