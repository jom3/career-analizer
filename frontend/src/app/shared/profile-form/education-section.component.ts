import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { ReactiveFormsModule, type FormArray } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';
import {
  newEducationForm,
  syncEndDate,
  type EducationForm,
} from '../../core/profile-form';
import { scrollToItem } from './section-utils';

@Component({
  selector: 'app-education-section',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card">
      <header class="section-header">
        <h2>{{ i18n.t('profile.education') }}</h2>
        <button type="button" class="btn btn--secondary btn--small" (click)="add()">
          + {{ i18n.t('profile.addEducation') }}
        </button>
      </header>
      @for (item of education().controls; track $index) {
        <div class="item" [formGroup]="item" [attr.id]="'education-item-' + $index">
          <div class="item-head">
            <span class="item-index">{{ $index + 1 }}</span>
            <button
              type="button"
              class="btn btn--danger btn--small"
              (click)="remove($index)"
            >
              {{ i18n.t('common.delete') }}
            </button>
          </div>
          <div class="form-fields">
            <label class="form-field field-full">
              {{ i18n.t('profile.degree') }}
              <input formControlName="degree" type="text" />
            </label>
            <label class="form-field field-wide">
              {{ i18n.t('profile.institution') }}
              <input formControlName="institution" type="text" />
            </label>
            <label class="form-field field-wide">
              {{ i18n.t('profile.field') }}
              <input formControlName="field" type="text" />
            </label>
            <label class="form-field field-xsmall">
              {{ i18n.t('profile.from') }}
              <input formControlName="startDate" type="date" />
            </label>
            <label class="form-field field-xsmall">
              {{ i18n.t('profile.to') }}
              <input formControlName="endDate" type="date" />
            </label>
            <label class="checkbox field-small">
              <input
                formControlName="current"
                type="checkbox"
                (change)="onCurrentChange(item, $event)"
              />
              {{ i18n.t('profile.inProgress') }}
            </label>
          </div>
          <label class="form-field field-full">
            {{ i18n.t('profile.description') }}
            <textarea formControlName="description" rows="3"></textarea>
          </label>
        </div>
      } @empty {
        <p class="muted">{{ i18n.t('profile.emptyEducation') }}</p>
      }
    </section>
  `,
})
export class EducationSectionComponent {
  readonly i18n = inject(I18nService);
  readonly education = input.required<FormArray<EducationForm>>();

  add(): void {
    const index = this.education().length;
    this.education().push(newEducationForm());
    scrollToItem('education', index);
  }

  remove(index: number): void {
    this.education().removeAt(index);
  }

  onCurrentChange(group: EducationForm, event: Event): void {
    syncEndDate(group, (event.target as HTMLInputElement).checked);
  }
}
