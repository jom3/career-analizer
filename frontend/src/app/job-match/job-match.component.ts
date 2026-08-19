import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CvAdaptationService } from '../core/cv-adaptation.service';
import { I18nService } from '../core/i18n/i18n.service';
import { JobMatchService } from '../core/job-match.service';
import type {
  DimensionKey,
  JobMatch,
  JobMatchGap,
  JobMatchRecommendation,
} from '../core/models/job-match';

const DIMENSION_KEYS: DimensionKey[] = [
  'skills',
  'experience',
  'education',
  'languages',
];

@Component({
  selector: 'app-job-match',
  imports: [RouterLink],
  templateUrl: './job-match.component.html',
  styleUrl: './job-match.component.scss',
})
export class JobMatchComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private readonly jobMatchService = inject(JobMatchService);
  private readonly cvAdaptationService = inject(CvAdaptationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly matches = signal<JobMatch[]>([]);
  readonly match = signal<JobMatch | null>(null);
  readonly recomputing = signal(false);
  readonly deleting = signal(false);
  readonly adapting = signal(false);

  readonly dimensionKeys = DIMENSION_KEYS;

  dimensionLabel(key: DimensionKey): string {
    return this.i18n.t(`jobMatch.dimension.${key}`);
  }

  gapStatusLabel(status: JobMatchGap['status']): string {
    return this.i18n.t(`jobMatch.gap.${status}`);
  }

  gapSourceLabel(source: JobMatchGap['source']): string {
    return this.i18n.t(`jobMatch.source.${source}`);
  }

  recommendationLabel(type: JobMatchRecommendation['type']): string {
    return this.i18n.t(`jobMatch.recommendation.${type}`);
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      await this.loadMatch(id);
    } else {
      await this.loadList();
    }
  }

  async loadList(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      this.matches.set(await this.jobMatchService.list());
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.loading.set(false);
    }
  }

  async loadMatch(id: string): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      this.match.set(await this.jobMatchService.get(id));
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.loading.set(false);
    }
  }

  async recompute(): Promise<void> {
    const current = this.match();
    if (!current) return;
    this.recomputing.set(true);
    this.errorMessage.set('');
    try {
      this.match.set(await this.jobMatchService.recompute(current.id));
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.recomputing.set(false);
    }
  }

  async deleteMatch(id: string): Promise<void> {
    if (!window.confirm(this.i18n.t('jobMatch.confirmDelete'))) return;
    this.deleting.set(true);
    this.errorMessage.set('');
    try {
      await this.jobMatchService.remove(id);
      await this.router.navigate(['/job-match']);
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.deleting.set(false);
    }
  }

  async adaptCv(): Promise<void> {
    const current = this.match();
    if (!current || !current.jobOfferId) return;
    this.adapting.set(true);
    this.errorMessage.set('');
    try {
      const adapted = await this.cvAdaptationService.create({
        jobOfferId: current.jobOfferId,
        jobMatchId: current.id,
      });
      await this.router.navigate(['/cv-adaptation', adapted.id]);
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.adapting.set(false);
    }
  }

  isNullScore(match: JobMatch | null): boolean {
    return match !== null && match.dimensions.every((d) => d.score === null);
  }

  formatDate(value: string): string {
    const date = new Date(value);
    const locale = this.i18n.is('en') ? 'en-US' : 'es-AR';
    return date.toLocaleDateString(locale);
  }

  private messageFor(error: unknown): string {
    console.error('job-match request failed:', error);
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return this.i18n.t('jobMatch.errorCors');
      }
      return this.i18n
        .t('jobMatch.errorServer')
        .replace('{status}', String(error.status));
    }
    return this.i18n.t('jobMatch.errorGeneric');
  }
}