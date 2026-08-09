import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api';
import type {
  JobAnalysisResult,
  JobOffer,
  JobOfferPayload,
} from './models/job-analysis';

@Injectable({ providedIn: 'root' })
export class JobAnalysisService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_BASE_URL;

  analyzeText(text: string): Promise<JobAnalysisResult> {
    const formData = new FormData();
    formData.append('text', text);
    return firstValueFrom(
      this.http.post<JobAnalysisResult>(
        `${this.apiUrl}/job-analysis/analyze`,
        formData,
      ),
    );
  }

  analyzeFile(file: File): Promise<JobAnalysisResult> {
    const formData = new FormData();
    formData.append('file', file);
    return firstValueFrom(
      this.http.post<JobAnalysisResult>(
        `${this.apiUrl}/job-analysis/analyze`,
        formData,
      ),
    );
  }

  create(payload: JobOfferPayload): Promise<JobOffer> {
    return firstValueFrom(
      this.http.post<JobOffer>(`${this.apiUrl}/job-analysis`, payload),
    );
  }

  list(): Promise<JobOffer[]> {
    return firstValueFrom(
      this.http.get<JobOffer[]>(`${this.apiUrl}/job-analysis`),
    );
  }

  get(id: string): Promise<JobOffer> {
    return firstValueFrom(
      this.http.get<JobOffer>(`${this.apiUrl}/job-analysis/${id}`),
    );
  }

  update(id: string, payload: JobOfferPayload): Promise<JobOffer> {
    return firstValueFrom(
      this.http.put<JobOffer>(`${this.apiUrl}/job-analysis/${id}`, payload),
    );
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.apiUrl}/job-analysis/${id}`),
    );
  }
}
