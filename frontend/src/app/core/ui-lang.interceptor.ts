import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { I18nService } from './i18n/i18n.service';

// Inyecta el idioma de interfaz activo en todas las requests como
// Accept-Language, para que el backend genere el contenido en ese idioma.
export const uiLangInterceptor: HttpInterceptorFn = (req, next) => {
  const i18n = inject(I18nService);
  return next(req.clone({ setHeaders: { 'Accept-Language': i18n.lang() } }));
};
