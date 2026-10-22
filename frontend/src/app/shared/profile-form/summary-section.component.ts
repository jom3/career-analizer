import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ReactiveFormsModule, type FormControl } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-summary-section',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card">
      <h2>{{ i18n.t('profile.summary') }}</h2>
      <label class="form-field field-full">
        {{ i18n.t('profile.summaryHint') }}
        <textarea [formControl]="summary()" rows="4"></textarea>
      </label>
    </section>
  `,
})
export class SummarySectionComponent {
  readonly i18n = inject(I18nService);
  readonly summary = input.required<FormControl<string>>();
}
