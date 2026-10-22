import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { credentialsInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('credentialsInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthService;
  const router = { url: '/job-match/match-1', navigate: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([credentialsInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    auth.user.set({
      id: 'user-1',
      email: 'user@test.dev',
      name: 'User',
      createdAt: '2026-01-01',
    });
  });

  afterEach(() => {
    httpMock.verify();
    auth.clearSession();
  });

  it('envía las credenciales en cada request', async () => {
    const promise = firstValueFrom(http.get('/api/job-match'));

    const request = httpMock.expectOne('/api/job-match');
    expect(request.request.withCredentials).toBe(true);
    request.flush([]);

    await promise;
  });

  it('ante un 401 limpia la sesión y vuelve al login con returnUrl', async () => {
    const promise = firstValueFrom(http.get('/api/job-match'));

    httpMock
      .expectOne('/api/job-match')
      .flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    await expect(promise).rejects.toBeTruthy();
    expect(auth.user()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/job-match/match-1' },
    });
  });

  it('no redirige cuando el 401 viene del chequeo de sesión', async () => {
    const promise = firstValueFrom(http.get('/api/auth/me'));

    httpMock
      .expectOne('/api/auth/me')
      .flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    await expect(promise).rejects.toBeTruthy();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('no redirige ni limpia la sesión ante otros errores', async () => {
    const promise = firstValueFrom(http.get('/api/job-match'));

    httpMock
      .expectOne('/api/job-match')
      .flush({ message: 'Boom' }, { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toBeTruthy();
    expect(auth.user()).not.toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
