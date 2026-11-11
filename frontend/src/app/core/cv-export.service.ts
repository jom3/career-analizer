import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { API_BASE_URL } from './api';
import { I18nService } from './i18n/i18n.service';

async function errorCode(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { code?: unknown };
    return typeof body?.code === 'string' ? body.code : undefined;
  } catch {
    return undefined;
  }
}

export type CvExportFormat = 'pdf' | 'docx';

export type CvDocumentPath = 'cv-export' | 'cv-photo' | 'cv-documented';

// Lleva el código del backend para que la UI muestre el motivo real
// (p. ej. demasiados anexos) en lugar de un error genérico.
export class CvDownloadError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`La descarga falló (${status}).`);
  }
}

const DEFAULT_FILENAME_BASE = 'curriculum';

@Injectable({ providedIn: 'root' })
export class CvExportService {
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly apiUrl = API_BASE_URL;

  async download(
    format: CvExportFormat,
    documentPath: CvDocumentPath = 'cv-export',
  ): Promise<void> {
    const response = await fetch(`${this.apiUrl}/${documentPath}?format=${format}`, {
      credentials: 'include',
      headers: { 'Accept-Language': this.i18n.lang() },
    });
    if (!response.ok) {
      if (response.status === 401) {
        await this.router.navigate(['/auth/login']);
      }
      throw new CvDownloadError(response.status, await errorCode(response));
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = this.filenameFrom(response, format);
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private filenameFrom(response: Response, format: CvExportFormat): string {
    const disposition = response.headers.get('content-disposition');
    const match = disposition?.match(/filename="?([^"]+)"?/i);
    return match?.[1] ?? `${DEFAULT_FILENAME_BASE}.${format}`;
  }
}
