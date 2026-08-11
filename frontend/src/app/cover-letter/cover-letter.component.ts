import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CoverLetterService } from './cover-letter.service';
import { I18nService } from '../core/i18n/i18n.service';
import type { CoverLetter } from '../core/models/cover-letter';

@Component({
  selector: 'app-cover-letter',
  imports: [RouterLink],
  templateUrl: './cover-letter.component.html',
  styleUrl: './cover-letter.component.scss',
})
export class CoverLetterComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private readonly coverLetterService = inject(CoverLetterService);

  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly letters = signal<CoverLetter[]>([]);

  async ngOnInit(): Promise<void> {
    await this.loadList();
  }

  async loadList(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      this.letters.set(await this.coverLetterService.list());
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.loading.set(false);
    }
  }

  formatDate(value: string): string {
    const locale = this.i18n.is('en') ? 'en-US' : 'es-AR';
    return new Date(value).toLocaleDateString(locale);
  }

  private messageFor(error: unknown): string {
    console.error('cover-letter request failed:', error);
    if (error instanceof HttpErrorResponse) {
      const backendMessage = (error.error as { message?: string | string[] })
        ?.message;
      if (typeof backendMessage === 'string' && backendMessage.length > 0) {
        return backendMessage;
      }
      if (Array.isArray(backendMessage) && backendMessage.length > 0) {
        return backendMessage.join(', ');
      }
      if (error.status === 0) {
        return this.i18n.t('coverLetter.errorCors');
      }
      return this.i18n
        .t('coverLetter.errorServer')
        .replace('{status}', String(error.status));
    }
    return this.i18n.t('coverLetter.errorGeneric');
  }
}