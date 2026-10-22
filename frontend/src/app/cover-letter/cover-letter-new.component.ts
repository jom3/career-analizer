import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { apiErrorKey } from '../core/http-errors';
import { I18nService } from '../core/i18n/i18n.service';
import { JobAnalysisService } from '../core/job-analysis.service';
import type { JobOffer } from '../core/models/job-analysis';
import {
  DocumentLangSelectComponent,
  type DocumentLang,
} from '../shared/document-lang-select.component';
import { CoverLetterService } from './cover-letter.service';

@Component({
  selector: 'app-cover-letter-new',
  imports: [ReactiveFormsModule, RouterLink, DocumentLangSelectComponent],
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
  readonly offers = signal<JobOffer[]>([]);
  readonly loadingOffers = signal(false);
  readonly documentLang = signal<DocumentLang>(this.i18n.lang());

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
    const query = this.route.snapshot.queryParamMap;
    const jobOfferId = query.get('jobOfferId');
    const lang = query.get('lang');
    if (lang === 'es' || lang === 'en') {
      this.documentLang.set(lang);
    }
    this.jobOfferId.set(jobOfferId);
    if (jobOfferId) {
      await this.loadOffer(jobOfferId);
    } else {
      await this.loadOffers();
    }
  }

  async loadOffers(): Promise<void> {
    this.loadingOffers.set(true);
    this.errorMessage.set('');
    try {
      this.offers.set(await this.jobAnalysisService.list());
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.loadingOffers.set(false);
    }
  }

  async selectOffer(id: string): Promise<void> {
    this.jobOfferId.set(id);
    await this.loadOffer(id);
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
        lang: this.documentLang(),
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