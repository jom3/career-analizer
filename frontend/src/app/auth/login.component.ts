import { Component, inject } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { httpErrorMessage } from '../core/http-errors';
import { I18nService } from '../core/i18n/i18n.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required]),
  });

  successMessage =
    this.route.snapshot.queryParamMap.get('reset') === 'ok'
      ? this.i18n.t('auth.resetPassword.success')
      : '';

  errorMessage = '';
  submitting = false;

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.errorMessage = this.i18n.t('errors.badRequest');
      return;
    }
    this.submitting = true;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      const { email, password } = this.form.value;
      await this.auth.login(email!, password!);
      await this.router.navigate(['/dashboard']);
    } catch (error) {
      this.errorMessage = this.i18n.t(
        httpErrorMessage(error, 'auth.login.error'),
      );
    } finally {
      this.submitting = false;
    }
  }
}