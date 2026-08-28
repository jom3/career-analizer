import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { httpErrorMessage } from '../core/http-errors';
import { I18nService } from '../core/i18n/i18n.service';

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent {
  readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';

  readonly form = new FormGroup(
    {
      password: new FormControl('', [
        Validators.required,
        Validators.minLength(8),
      ]),
      confirm: new FormControl('', [Validators.required]),
    },
    { validators: this.matchingPasswords },
  );

  readonly errorMessage = signal('');
  readonly submitting = signal(false);

  get invalidToken(): boolean {
    return !this.token;
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.errorMessage.set(this.i18n.t('errors.badRequest'));
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set('');
    try {
      const { password } = this.form.value;
      await this.auth.resetPassword(this.token, password!);
      await this.router.navigate(['/auth/login'], {
        queryParams: { reset: 'ok' },
      });
    } catch (error) {
      this.errorMessage.set(
        this.i18n.t(httpErrorMessage(error, 'auth.resetPassword.error')),
      );
    } finally {
      this.submitting.set(false);
    }
  }

  private matchingPasswords(
    group: AbstractControl,
  ): Record<string, boolean> | null {
    const { password, confirm } = group.value;
    return password && confirm && password !== confirm
      ? { mismatch: true }
      : null;
  }
}