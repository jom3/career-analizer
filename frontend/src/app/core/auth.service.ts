import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api';
import type { User } from './models/user';

interface AuthResponse {
  user: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_BASE_URL;

  readonly user = signal<User | null>(null);

  get isAuthenticated(): boolean {
    return this.user() !== null;
  }

  async register(name: string, email: string, password: string): Promise<User> {
    const { user } = await firstValueFrom(
      this.http.post<AuthResponse>(`${this.apiUrl}/auth/register`, {
        name,
        email,
        password,
      }),
    );
    this.user.set(user);
    return user;
  }

  async login(email: string, password: string): Promise<User> {
    const { user } = await firstValueFrom(
      this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, { email, password }),
    );
    this.user.set(user);
    return user;
  }

  async logout(): Promise<void> {
    await firstValueFrom(
      this.http.post<{ ok: boolean }>(`${this.apiUrl}/auth/logout`, {}),
    );
    this.user.set(null);
  }

  async fetchMe(): Promise<User> {
    const { user } = await firstValueFrom(
      this.http.get<AuthResponse>(`${this.apiUrl}/auth/me`),
    );
    this.user.set(user);
    return user;
  }

  async forgotPassword(email: string): Promise<void> {
    await firstValueFrom(
      this.http.post<{ ok: boolean }>(`${this.apiUrl}/auth/forgot-password`, {
        email,
      }),
    );
  }

  async resetPassword(token: string, password: string): Promise<void> {
    await firstValueFrom(
      this.http.post<{ ok: boolean }>(`${this.apiUrl}/auth/reset-password`, {
        token,
        password,
      }),
    );
  }
}