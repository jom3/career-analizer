import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login.component';
import { RegisterComponent } from './auth/register.component';
import { authGuard } from './core/auth.guard';
import { CoverLetterComponent } from './cover-letter/cover-letter.component';
import { CoverLetterDetailComponent } from './cover-letter/cover-letter-detail.component';
import { CoverLetterNewComponent } from './cover-letter/cover-letter-new.component';
import { CvAdaptationComponent } from './cv-adaptation/cv-adaptation.component';
import { CvImportComponent } from './cv-import/cv-import.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { JobAnalysisComponent } from './job-analysis/job-analysis.component';
import { JobMatchComponent } from './job-match/job-match.component';
import { ProfileComponent } from './profile/profile.component';

export const routes: Routes = [
  { path: 'auth/login', component: LoginComponent },
  { path: 'auth/register', component: RegisterComponent },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
  },
  {
    path: 'profile',
    component: ProfileComponent,
    canActivate: [authGuard],
  },
  {
    path: 'cv-import',
    component: CvImportComponent,
    canActivate: [authGuard],
  },
  {
    path: 'job-analysis',
    component: JobAnalysisComponent,
    canActivate: [authGuard],
  },
  {
    path: 'job-match',
    component: JobMatchComponent,
    canActivate: [authGuard],
  },
  {
    path: 'job-match/:id',
    component: JobMatchComponent,
    canActivate: [authGuard],
  },
  {
    path: 'cv-adaptation',
    component: CvAdaptationComponent,
    canActivate: [authGuard],
  },
  {
    path: 'cv-adaptation/:id',
    component: CvAdaptationComponent,
    canActivate: [authGuard],
  },
  {
    path: 'cover-letter',
    component: CoverLetterComponent,
    canActivate: [authGuard],
  },
  {
    path: 'cover-letter/new',
    component: CoverLetterNewComponent,
    canActivate: [authGuard],
  },
  {
    path: 'cover-letter/:id',
    component: CoverLetterDetailComponent,
    canActivate: [authGuard],
  },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: '**', redirectTo: 'dashboard' },
];