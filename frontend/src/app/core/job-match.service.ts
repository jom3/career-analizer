import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api';
import type { CreateMatchRequest, JobMatch } from './models/job-match';

@Injectable({ providedIn: 'root' })
export class JobMatchService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_BASE_URL;

  create(request: CreateMatchRequest): Promise<JobMatch> {
    return firstValueFrom(
      this.http.post<JobMatch>(`${this.apiUrl}/job-match`, request),
    );
  }

  list(): Promise<JobMatch[]> {
    return firstValueFrom(
      this.http.get<JobMatch[]>(`${this.apiUrl}/job-match`),
    );
  }

  get(id: string): Promise<JobMatch> {
    return firstValueFrom(
      this.http.get<JobMatch>(`${this.apiUrl}/job-match/${id}`),
    );
  }

  recompute(id: string): Promise<JobMatch> {
    return firstValueFrom(
      this.http.post<JobMatch>(
        `${this.apiUrl}/job-match/${id}/recompute`,
        null,
      ),
    );
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.apiUrl}/job-match/${id}`),
    );
  }
}