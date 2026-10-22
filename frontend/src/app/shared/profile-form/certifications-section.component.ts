import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { ReactiveFormsModule, type FormArray } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';
import {
  newCertificationForm,
  type CertificationForm,
} from '../../core/profile-form';
import { scrollToItem } from './section-utils';

@Component({
  selector: 'app-certifications-section',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card">
      <header class="section-header">
        <h2>{{ i18n.t('profile.certifications') }}</h2>
        <button type="button" class="btn btn--secondary btn--small" (click)="add()">
          + {{ i18n.t('profile.addCertification') }}
        </button>
      </header>
      @for (item of certifications().controls; track $index) {
        <div
          class="item"
          [formGroup]="item"
          [attr.id]="'certification-item-' + $index"
        >
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
              {{ i18n.t('profile.certName') }}
              <input formControlName="name" type="text" />
            </label>
            <label class="form-field field-wide">
              {{ i18n.t('profile.issuer') }}
              <input formControlName="issuer" type="text" />
            </label>
            <label class="form-field field-medium">
              {{ i18n.t('profile.url') }}
              <input formControlName="url" type="url" />
            </label>
            <label class="form-field field-xsmall">
              {{ i18n.t('profile.year') }}
              <input formControlName="year" type="number" min="1900" max="2100" />
            </label>
          </div>
        </div>
      } @empty {
        <p class="muted">{{ i18n.t('profile.emptyCertifications') }}</p>
      }
    </section>
  `,
})
export class CertificationsSectionComponent {
  readonly i18n = inject(I18nService);
  readonly certifications = input.required<FormArray<CertificationForm>>();

  add(): void {
    const index = this.certifications().length;
    this.certifications().push(newCertificationForm());
    scrollToItem('certification', index);
  }

  remove(index: number): void {
    this.certifications().removeAt(index);
  }
}
