import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api';
import type { CvDocument, CvImportResult } from './models/cv-import';

@Injectable({ providedIn: 'root' })
export class CvImportService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_BASE_URL;

  upload(file: File): Promise<CvImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    return firstValueFrom(
      this.http.post<CvImportResult>(`${this.apiUrl}/cv-import`, formData),
    );
  }

  getDocument(id: string): Promise<CvDocument> {
    return firstValueFrom(
      this.http.get<CvDocument>(`${this.apiUrl}/cv-import/${id}`),
    );
  }
}
