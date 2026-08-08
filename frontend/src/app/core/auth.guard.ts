import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated) {
    return true;
  }
  try {
    await auth.fetchMe();
    return true;
  } catch {
    return router.createUrlTree(['/auth/login']);
  }
};