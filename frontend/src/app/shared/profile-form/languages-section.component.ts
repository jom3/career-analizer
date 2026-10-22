import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { ReactiveFormsModule, type FormArray } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';
import {
  CEFR_LEVELS,
  newLanguageForm,
  type LanguageForm,
} from '../../core/profile-form';
import { scrollToItem } from './section-utils';

@Component({
  selector: 'app-languages-section',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card">
      <header class="section-header">
        <h2>{{ i18n.t('profile.languages') }}</h2>
        <button type="button" class="btn btn--secondary btn--small" (click)="add()">
          + {{ i18n.t('profile.addLanguage') }}
        </button>
      </header>
      @for (item of languages().controls; track $index) {
        <div class="item compact" [formGroup]="item" [attr.id]="'language-item-' + $index">
          <label class="form-field">
            {{ i18n.t('profile.language') }}
            <input formControlName="name" type="text" />
          </label>
          <label class="form-field field-value">
            {{ i18n.t('profile.level') }}
            <select formControlName="level">
              @for (level of levels; track level) {
                <option [ngValue]="level">{{ level }}</option>
              }
            </select>
          </label>
          <button
            type="button"
            class="btn btn--danger btn--small"
            (click)="remove($index)"
          >
            {{ i18n.t('common.delete') }}
          </button>
        </div>
      } @empty {
        <p class="muted">{{ i18n.t('profile.emptyLanguages') }}</p>
      }
    </section>
  `,
})
export class LanguagesSectionComponent {
  readonly i18n = inject(I18nService);
  readonly languages = input.required<FormArray<LanguageForm>>();
  readonly levels = CEFR_LEVELS;

  add(): void {
    const index = this.languages().length;
    this.languages().push(newLanguageForm());
    scrollToItem('language', index);
  }

  remove(index: number): void {
    this.languages().removeAt(index);
  }
}
