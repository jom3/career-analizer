import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { CoverLetterService } from '../cover-letter/cover-letter.service';
import { CvAdaptationService } from '../core/cv-adaptation.service';
import { I18nService } from '../core/i18n/i18n.service';
import { JobAnalysisService } from '../core/job-analysis.service';
import { JobMatchService } from '../core/job-match.service';
import { apiErrorKey } from '../core/http-errors';
import { ProfileService } from '../core/profile.service';
import type { Profile } from '../core/models/profile';
import {
  completenessPercent,
  missingProfileSections,
} from './dashboard-completeness';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  private readonly profileService = inject(ProfileService);
  private readonly jobAnalysisService = inject(JobAnalysisService);
  private readonly jobMatchService = inject(JobMatchService);
  private readonly cvAdaptationService = inject(CvAdaptationService);
  private readonly coverLetterService = inject(CoverLetterService);

  readonly user = this.auth.user;

  readonly loading = signal(true);
  readonly errorMessage = signal('');

  readonly profile = signal<Profile | null>(null);
  readonly offersCount = signal(0);
  readonly matchesCount = signal(0);
  readonly adaptedCvsCount = signal(0);
  readonly lettersCount = signal(0);
  readonly pendingOffersCount = signal(0);
  readonly missingSections = signal<string[]>([]);

  async ngOnInit(): Promise<void> {
    await this.loadSummary();
  }

  async loadSummary(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    const results = await Promise.allSettled([
      this.loadProfile(),
      this.loadOffers(),
      this.loadMatches(),
      this.loadAdaptedCvs(),
      this.loadLetters(),
    ]);
    const failed = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failed) {
      this.errorMessage.set(this.messageFor(failed.reason));
    }
    this.loading.set(false);
  }

  profileCompleteness(): number {
    return completenessPercent(this.missingSections());
  }

  private async loadProfile(): Promise<void> {
    const profile = await this.profileService.getProfile();
    this.profile.set(profile);
    this.missingSections.set(missingProfileSections(profile));
  }

  private async loadOffers(): Promise<void> {
    const offers = await this.jobAnalysisService.list();
    this.offersCount.set(offers.length);
    this.pendingOffersCount.set(
      offers.filter((offer) => offer.status === 'PENDING').length,
    );
  }

  private async loadMatches(): Promise<void> {
    this.matchesCount.set((await this.jobMatchService.list()).length);
  }

  private async loadAdaptedCvs(): Promise<void> {
    this.adaptedCvsCount.set((await this.cvAdaptationService.list()).length);
  }

  private async loadLetters(): Promise<void> {
    this.lettersCount.set((await this.coverLetterService.list()).length);
  }

  private messageFor(error: unknown): string {
    const mapped = apiErrorKey(error);
    if (mapped) return this.i18n.t(mapped);
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return this.i18n.t('dashboard.errorCors');
    }
    return this.i18n.t('dashboard.errorGeneric');
  }
}