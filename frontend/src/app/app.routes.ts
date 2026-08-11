import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login.component';
import { RegisterComponent } from './auth/register.component';
import { authGuard } from './core/auth.guard';
import { ShellComponent } from './layout/shell.component';
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
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'profile', component: ProfileComponent },
      { path: 'cv-import', component: CvImportComponent },
      { path: 'job-analysis', component: JobAnalysisComponent },
      { path: 'job-match', component: JobMatchComponent },
      { path: 'job-match/:id', component: JobMatchComponent },
      { path: 'cv-adaptation', component: CvAdaptationComponent },
      { path: 'cv-adaptation/:id', component: CvAdaptationComponent },
      { path: 'cover-letter', component: CoverLetterComponent },
      { path: 'cover-letter/new', component: CoverLetterNewComponent },
      { path: 'cover-letter/:id', component: CoverLetterDetailComponent },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];