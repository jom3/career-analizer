import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login.component';
import { RegisterComponent } from './auth/register.component';
import { authGuard } from './core/auth.guard';
import { CvImportComponent } from './cv-import/cv-import.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { JobAnalysisComponent } from './job-analysis/job-analysis.component';
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
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: '**', redirectTo: 'dashboard' },
];