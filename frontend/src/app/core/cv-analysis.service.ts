import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api';
import type { CvAnalysis } from './models/cv-analysis';

@Injectable({ providedIn: 'root' })
export class CvAnalysisService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_BASE_URL;

  analyze(): Promise<CvAnalysis> {
    return firstValueFrom(
      this.http.get<CvAnalysis>(`${this.apiUrl}/cv-analysis`),
    );
  }
}
