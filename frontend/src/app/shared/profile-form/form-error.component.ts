import { Component, inject, input } from '@angular/core';
import type { FormGroup } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';
import { describeFormError } from '../../core/profile-errors';

// Mensaje concreto del primer campo inválido del borrador del modal.
@Component({
  selector: 'app-form-error',
  template: `
    @if (message()) {
      <p class="alert alert--error" role="alert">{{ message() }}</p>
    }
  `,
})
export class FormErrorComponent {
  readonly i18n = inject(I18nService);
  readonly form = input.required<FormGroup>();
  readonly section = input<string | null>(null);

  message(): string | null {
    return describeFormError(this.form(), this.i18n, this.section());
  }
}
