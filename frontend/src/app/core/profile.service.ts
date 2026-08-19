import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api';
import type { Profile, ProfilePayload } from './models/profile';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_BASE_URL;

  getProfile(): Promise<Profile> {
    return firstValueFrom(this.http.get<Profile>(`${this.apiUrl}/profile`));
  }

  putProfile(profile: ProfilePayload): Promise<Profile> {
    return firstValueFrom(
      this.http.put<Profile>(`${this.apiUrl}/profile`, profile),
    );
  }

  translateProfile(lang: 'es' | 'en', from?: 'es' | 'en'): Promise<Profile> {
    return firstValueFrom(
      this.http.post<Profile>(`${this.apiUrl}/profile/translate`, {
        lang,
        from,
      }),
    );
  }
}
