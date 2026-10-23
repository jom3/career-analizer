import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CvAnalysisService } from '../core/cv-analysis.service';
import { apiErrorKey } from '../core/http-errors';
import { I18nService } from '../core/i18n/i18n.service';
import type {
  CvAnalysis,
  CvCheck,
  CvSection,
  CvSuggestion,
} from '../core/models/cv-analysis';

@Component({
  selector: 'app-cv-analysis',
  imports: [RouterLink],
  templateUrl: './cv-analysis.component.html',
  styleUrl: './cv-analysis.component.scss',
})
export class CvAnalysisComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private readonly cvAnalysisService = inject(CvAnalysisService);

  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly analysis = signal<CvAnalysis | null>(null);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      this.analysis.set(await this.cvAnalysisService.analyze());
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.loading.set(false);
    }
  }

  checkLabel(check: CvCheck): string {
    return this.i18n.t(`cvAnalysis.check.${check.key}`);
  }

  checkHint(check: CvCheck): string {
    return this.i18n.t(`cvAnalysis.hint.${check.key}`);
  }

  sectionLabel(section: CvSection): string {
    return this.i18n.t(`cvAnalysis.section.${section}`);
  }

  trackSuggestion(_index: number, suggestion: CvSuggestion): string {
    return `${suggestion.section}|${suggestion.action}`;
  }

  isEmpty(analysis: CvAnalysis): boolean {
    return analysis.checks.every((check) => !check.ok);
  }

  private messageFor(error: unknown): string {
    console.error('cv-analysis request failed:', error);
    const mapped = apiErrorKey(error);
    if (mapped) return this.i18n.t(mapped);
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return this.i18n.t('cvAnalysis.errorCors');
    }
    return this.i18n.t('cvAnalysis.errorGeneric');
  }
}
