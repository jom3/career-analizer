import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { I18nService } from '../core/i18n/i18n.service';
import { JobAnalysisService } from '../core/job-analysis.service';
import type { JobOffer } from '../core/models/job-analysis';
import { CoverLetterService } from './cover-letter.service';

@Component({
  selector: 'app-cover-letter-new',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './cover-letter-new.component.html',
  styleUrl: './cover-letter-new.component.scss',
})
export class CoverLetterNewComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private readonly coverLetterService = inject(CoverLetterService);
  private readonly jobAnalysisService = inject(JobAnalysisService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly jobOfferId = signal<string | null>(null);
  readonly offer = signal<JobOffer | null>(null);
  readonly loadingOffer = signal(false);
  readonly generating = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly draftContent = signal('');
  readonly draftLanguage = signal<string | null>(null);

  readonly form = new FormGroup({
    recruiterName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(120)],
    }),
    note: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(2000)],
    }),
  });

  async ngOnInit(): Promise<void> {
    const jobOfferId = this.route.snapshot.queryParamMap.get('jobOfferId');
    this.jobOfferId.set(jobOfferId);
    if (jobOfferId) {
      await this.loadOffer(jobOfferId);
    }
  }

  async loadOffer(id: string): Promise<void> {
    this.loadingOffer.set(true);
    this.errorMessage.set('');
    try {
      this.offer.set(await this.jobAnalysisService.get(id));
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.loadingOffer.set(false);
    }
  }

  async generateDraft(): Promise<void> {
    const jobOfferId = this.jobOfferId();
    if (!jobOfferId) return;
    this.generating.set(true);
    this.errorMessage.set('');
    try {
      const request = {
        jobOfferId,
        ...(this.form.value.recruiterName?.trim()
          ? { recruiterName: this.form.value.recruiterName.trim() }
          : {}),
        ...(this.form.value.note?.trim()
          ? { note: this.form.value.note.trim() }
          : {}),
      };
      const draft = await this.coverLetterService.draft(request);
      this.draftContent.set(draft.content);
      this.draftLanguage.set(draft.sourceLanguage);
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.generating.set(false);
    }
  }

  async save(): Promise<void> {
    const jobOfferId = this.jobOfferId();
    const content = this.draftContent().trim();
    if (!jobOfferId || !content) {
      this.errorMessage.set(this.i18n.t('coverLetter.needDraft'));
      return;
    }
    this.saving.set(true);
    this.errorMessage.set('');
    try {
      const request = {
        jobOfferId,
        content,
        ...(this.form.value.recruiterName?.trim()
          ? { recruiterName: this.form.value.recruiterName.trim() }
          : {}),
        ...(this.form.value.note?.trim()
          ? { note: this.form.value.note.trim() }
          : {}),
      };
      const created = await this.coverLetterService.create(request);
      await this.router.navigate(['/cover-letter', created.id]);
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.saving.set(false);
    }
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