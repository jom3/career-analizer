import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { apiErrorKey } from '../core/http-errors';
import { I18nService } from '../core/i18n/i18n.service';
import type { CvExportFormat } from '../core/models/cover-letter';
import { CoverLetterService } from './cover-letter.service';
import type { CoverLetter } from '../core/models/cover-letter';
import { OfferContextCardComponent } from '../shared/offer-context-card.component';

@Component({
  selector: 'app-cover-letter-detail',
  imports: [RouterLink, OfferContextCardComponent],
  templateUrl: './cover-letter-detail.component.html',
  styleUrl: './cover-letter-detail.component.scss',
})
export class CoverLetterDetailComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private readonly coverLetterService = inject(CoverLetterService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly letter = signal<CoverLetter | null>(null);
  readonly exporting = signal<CvExportFormat | null>(null);
  readonly deleting = signal(false);
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly editedContent = signal('');

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      await this.loadLetter(id);
    }
  }

  async loadLetter(id: string): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      this.letter.set(await this.coverLetterService.get(id));
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.loading.set(false);
    }
  }

  async exportLetter(format: CvExportFormat): Promise<void> {
    const current = this.letter();
    if (!current) return;
    this.exporting.set(format);
    this.errorMessage.set('');
    try {
      await this.coverLetterService.download(current.id, format);
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.exporting.set(null);
    }
  }

  startEditing(): void {
    this.editedContent.set(this.letter()?.content ?? '');
    this.editing.set(true);
  }

  cancelEditing(): void {
    this.editing.set(false);
  }

  async saveContent(): Promise<void> {
    const current = this.letter();
    const content = this.editedContent().trim();
    if (!current || !content) return;
    this.saving.set(true);
    this.errorMessage.set('');
    try {
      this.letter.set(await this.coverLetterService.update(current.id, content));
      this.editing.set(false);
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteLetter(): Promise<void> {
    const current = this.letter();
    if (!current) return;
    if (!window.confirm(this.i18n.t('coverLetter.confirmDelete'))) return;
    this.deleting.set(true);
    this.errorMessage.set('');
    try {
      await this.coverLetterService.delete(current.id);
      await this.router.navigate(['/cover-letter']);
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.deleting.set(false);
    }
  }

  formatDate(value: string): string {
    const locale = this.i18n.is('en') ? 'en-US' : 'es-AR';
    return new Date(value).toLocaleDateString(locale);
  }

  private messageFor(error: unknown): string {
    console.error('cover-letter request failed:', error);
    const mapped = apiErrorKey(error);
    if (mapped) return this.i18n.t(mapped);
    if (error instanceof HttpErrorResponse) {
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