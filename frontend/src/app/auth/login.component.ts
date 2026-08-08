import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required]),
  });

  errorMessage = '';
  submitting = false;

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.errorMessage = 'Completá los campos correctamente';
      return;
    }
    this.submitting = true;
    this.errorMessage = '';
    try {
      const { email, password } = this.form.value;
      await this.auth.login(email!, password!);
      await this.router.navigate(['/dashboard']);
    } catch (error) {
      this.errorMessage = this.messageFor(error);
    } finally {
      this.submitting = false;
    }
  }

  private messageFor(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      return 'Email o contraseña incorrectos';
    }
    return 'No se pudo iniciar sesión. Intentalo de nuevo.';
  }
}