import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api';
import type { Profile, ProfilePayload } from './models/profile';

export type DocumentSection = 'education' | 'certifications';

export interface UploadedDocument {
  documentName: string;
  documentMimeType: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_BASE_URL;

  photoUrl(): string {
    return `${this.apiUrl}/profile/photo`;
  }

  documentUrl(section: DocumentSection, itemId: string): string {
    return `${this.apiUrl}/profile/${section}/${itemId}/document`;
  }

  uploadPhoto(file: File): Promise<{ photoMimeType: string }> {
    return firstValueFrom(
      this.http.put<{ photoMimeType: string }>(
        `${this.apiUrl}/profile/photo`,
        this.fileForm(file),
      ),
    );
  }

  deletePhoto(): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.apiUrl}/profile/photo`));
  }

  uploadDocument(
    section: DocumentSection,
    itemId: string,
    file: File,
  ): Promise<UploadedDocument> {
    return firstValueFrom(
      this.http.put<UploadedDocument>(
        this.documentUrl(section, itemId),
        this.fileForm(file),
      ),
    );
  }

  deleteDocument(section: DocumentSection, itemId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(this.documentUrl(section, itemId)),
    );
  }

  private fileForm(file: File): FormData {
    const body = new FormData();
    body.append('file', file);
    return body;
  }

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
