import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { API_BASE_URL } from './api';

export type CvExportFormat = 'pdf' | 'docx';

const DEFAULT_FILENAMES: Record<CvExportFormat, string> = {
  pdf: 'curriculum.pdf',
  docx: 'curriculum.docx',
};

@Injectable({ providedIn: 'root' })
export class CvExportService {
  private readonly router = inject(Router);
  private readonly apiUrl = API_BASE_URL;

  async download(format: CvExportFormat): Promise<void> {
    const response = await fetch(`${this.apiUrl}/cv-export?format=${format}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      if (response.status === 401) {
        await this.router.navigate(['/auth/login']);
      }
      throw new Error(`La descarga falló (${response.status}).`);
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
    return match?.[1] ?? DEFAULT_FILENAMES[format];
  }
}
