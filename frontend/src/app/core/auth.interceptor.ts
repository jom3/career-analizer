import {
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

// Envía la cookie de sesión y, si el backend responde 401 (sesión expirada),
// limpia el estado y manda al login conservando la ruta de origen.
export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req.clone({ withCredentials: true })).pipe(
    catchError((error: unknown) => {
      const isAuthCheck = req.url.endsWith('/auth/me');
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !isAuthCheck
      ) {
        auth.clearSession();
        void router.navigate(['/auth/login'], {
          queryParams: { returnUrl: router.url },
        });
      }
      return throwError(() => error);
    }),
  );
};
