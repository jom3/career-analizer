import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api';
import type {
  AdaptedCv,
  CreateAdaptationRequest,
  CvExportFormat,
} from './models/adapted-cv';

@Injectable({ providedIn: 'root' })
export class CvAdaptationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_BASE_URL;

  create(request: CreateAdaptationRequest): Promise<AdaptedCv> {
    return firstValueFrom(
      this.http.post<AdaptedCv>(`${this.apiUrl}/cv-adaptation`, request),
    );
  }

  list(): Promise<AdaptedCv[]> {
    return firstValueFrom(
      this.http.get<AdaptedCv[]>(`${this.apiUrl}/cv-adaptation`),
    );
  }

  get(id: string): Promise<AdaptedCv> {
    return firstValueFrom(
      this.http.get<AdaptedCv>(`${this.apiUrl}/cv-adaptation/${id}`),
    );
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.apiUrl}/cv-adaptation/${id}`),
    );
  }

  async download(id: string, format: CvExportFormat): Promise<void> {
    const response = await firstValueFrom(
      this.http.get(`${this.apiUrl}/cv-adaptation/${id}/export`, {
        params: { format },
        responseType: 'blob',
        observe: 'response',
      }),
    );
    const fallbackName = format === 'pdf' ? 'cv-adaptado.pdf' : 'cv-adaptado.docx';
    const disposition = response.headers.get('Content-Disposition');
    const fileName = disposition?.match(/filename="?([^";]+)"?/)?.[1] ?? fallbackName;
    const objectUrl = URL.createObjectURL(response.body!);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }
}