import { Component, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { httpErrorMessage } from '../core/http-errors';
import { I18nService } from '../core/i18n/i18n.service';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);

  readonly form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
  });

  readonly errorMessage = signal('');
  readonly success = signal(false);
  readonly submitting = signal(false);

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.errorMessage.set(this.i18n.t('errors.badRequest'));
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set('');
    try {
      const { email } = this.form.value;
      await this.auth.forgotPassword(email!);
      this.success.set(true);
    } catch (error) {
      this.errorMessage.set(
        this.i18n.t(httpErrorMessage(error, 'auth.forgotPassword.error')),
      );
    } finally {
      this.submitting.set(false);
    }
  }
}