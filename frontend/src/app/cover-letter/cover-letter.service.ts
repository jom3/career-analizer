import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../core/api';
import type {
  CoverLetter,
  CoverLetterDraft,
  CoverLetterDraftRequest,
  CreateCoverLetterRequest,
  CvExportFormat,
} from '../core/models/cover-letter';

@Injectable({ providedIn: 'root' })
export class CoverLetterService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_BASE_URL;

  draft(request: CoverLetterDraftRequest): Promise<CoverLetterDraft> {
    return firstValueFrom(
      this.http.post<CoverLetterDraft>(
        `${this.apiUrl}/cover-letter/draft`,
        request,
      ),
    );
  }

  create(request: CreateCoverLetterRequest): Promise<CoverLetter> {
    return firstValueFrom(
      this.http.post<CoverLetter>(`${this.apiUrl}/cover-letter`, request),
    );
  }

  list(): Promise<CoverLetter[]> {
    return firstValueFrom(
      this.http.get<CoverLetter[]>(`${this.apiUrl}/cover-letter`),
    );
  }

  get(id: string): Promise<CoverLetter> {
    return firstValueFrom(
      this.http.get<CoverLetter>(`${this.apiUrl}/cover-letter/${id}`),
    );
  }

  delete(id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.apiUrl}/cover-letter/${id}`),
    );
  }

  async download(
    id: string,
    format: CvExportFormat,
    lang?: 'es' | 'en',
  ): Promise<void> {
    const params: Record<string, string> = { format };
    if (lang) {
      params['lang'] = lang;
    }
    const response = await firstValueFrom(
      this.http.get(`${this.apiUrl}/cover-letter/${id}/export`, {
        params,
        responseType: 'blob',
        observe: 'response',
      }),
    );
    const fallbackName =
      format === 'pdf' ? 'carta-motivacion.pdf' : 'carta-motivacion.docx';
    const disposition = response.headers.get('Content-Disposition');
    const fileName =
      disposition?.match(/filename="?([^";]+)"?/)?.[1] ?? fallbackName;
    const objectUrl = URL.createObjectURL(response.body!);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }
}