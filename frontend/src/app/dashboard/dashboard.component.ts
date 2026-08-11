import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { CoverLetterService } from '../cover-letter/cover-letter.service';
import { CvAdaptationService } from '../core/cv-adaptation.service';
import { I18nService } from '../core/i18n/i18n.service';
import { JobAnalysisService } from '../core/job-analysis.service';
import { JobMatchService } from '../core/job-match.service';
import { ProfileService } from '../core/profile.service';
import type { Profile } from '../core/models/profile';
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

  async ngOnInit(): Promise<void> {
    await this.loadSummary();
  }

  async loadSummary(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      await Promise.all([
        this.loadProfile(),
        this.loadOffers(),
        this.loadMatches(),
        this.loadAdaptedCvs(),
        this.loadLetters(),
      ]);
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.loading.set(false);
    }
  }

  profileCompleteness(): number {
    const p = this.profile();
    if (!p) return 0;
    const sections = [
      p.skills.length > 0,
      p.experiences.length > 0,
      p.education.length > 0,
    ];
    const done = sections.filter(Boolean).length;
    return Math.round((done / sections.length) * 100);
  }

  private async loadProfile(): Promise<void> {
    try {
      this.profile.set(await this.profileService.getProfile());
    } catch {
      this.profile.set(null);
    }
  }

  private async loadOffers(): Promise<void> {
    try {
      this.offersCount.set((await this.jobAnalysisService.list()).length);
    } catch {
      this.offersCount.set(0);
    }
  }

  private async loadMatches(): Promise<void> {
    try {
      this.matchesCount.set((await this.jobMatchService.list()).length);
    } catch {
      this.matchesCount.set(0);
    }
  }

  private async loadAdaptedCvs(): Promise<void> {
    try {
      this.adaptedCvsCount.set((await this.cvAdaptationService.list()).length);
    } catch {
      this.adaptedCvsCount.set(0);
    }
  }

  private async loadLetters(): Promise<void> {
    try {
      this.lettersCount.set((await this.coverLetterService.list()).length);
    } catch {
      this.lettersCount.set(0);
    }
  }

  private messageFor(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return this.i18n.t('dashboard.errorCors');
    }
    return this.i18n.t('dashboard.errorGeneric');
  }
}