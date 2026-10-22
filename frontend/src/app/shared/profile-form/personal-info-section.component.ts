import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ReactiveFormsModule, type FormControl } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-personal-info-section',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card">
      <h2>{{ i18n.t('profile.personalInfo') }}</h2>
      <div class="form-fields">
        <label class="form-field field-full">
          {{ i18n.t('profile.headline') }}
          <input [formControl]="headline()" type="text" />
        </label>
        <label class="form-field field-small">
          {{ i18n.t('profile.phone') }}
          <input [formControl]="phone()" type="tel" />
        </label>
        <label class="form-field field-medium">
          {{ i18n.t('profile.location') }}
          <input [formControl]="location()" type="text" />
        </label>
        <label class="form-field field-medium">
          {{ i18n.t('profile.website') }}
          <input [formControl]="website()" type="url" />
        </label>
        <label class="form-field field-medium">
          {{ i18n.t('profile.linkedin') }}
          <input [formControl]="linkedin()" type="url" />
        </label>
      </div>
    </section>
  `,
})
export class PersonalInfoSectionComponent {
  readonly i18n = inject(I18nService);
  readonly headline = input.required<FormControl<string>>();
  readonly phone = input.required<FormControl<string>>();
  readonly location = input.required<FormControl<string>>();
  readonly website = input.required<FormControl<string>>();
  readonly linkedin = input.required<FormControl<string>>();
}
