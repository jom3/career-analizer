import { Component, inject } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { httpErrorMessage } from '../core/http-errors';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.minLength(2)]),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(8),
    ]),
  });

  errorMessage = '';
  submitting = false;

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.errorMessage = 'Revisá los campos del formulario';
      return;
    }
    this.submitting = true;
    this.errorMessage = '';
    try {
      const { name, email, password } = this.form.value;
      await this.auth.register(name!, email!, password!);
      await this.router.navigate(['/dashboard']);
    } catch (error) {
      this.errorMessage = httpErrorMessage(
        error,
        'No se pudo crear la cuenta. Intentalo de nuevo.',
      );
    } finally {
      this.submitting = false;
    }
  }
}