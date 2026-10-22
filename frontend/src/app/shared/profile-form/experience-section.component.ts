import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { ReactiveFormsModule, type FormArray } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';
import {
  newExperienceForm,
  newMetricForm,
  syncEndDate,
  type ExperienceForm,
} from '../../core/profile-form';
import { scrollToItem } from './section-utils';

@Component({
  selector: 'app-experience-section',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card">
      <header class="section-header">
        <h2>{{ i18n.t('profile.experience') }}</h2>
        <button type="button" class="btn btn--secondary btn--small" (click)="add()">
          + {{ i18n.t('profile.addExperience') }}
        </button>
      </header>
      @for (item of experiences().controls; track $index) {
        <div class="item" [formGroup]="item" [attr.id]="'experience-item-' + $index">
          <div class="item-head">
            <span class="item-index">{{ $index + 1 }}</span>
            @if (duplicateIndices().has($index)) {
              <span class="tag tag--duplicate">{{ i18n.t('profile.duplicate') }}</span>
            }
            @if (overlapIndices().has($index)) {
              <span class="tag tag--duplicate" [title]="i18n.t('profile.overlap')">
                {{ i18n.t('profile.overlap') }}
              </span>
            }
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
              {{ i18n.t('profile.company') }}
              <input formControlName="company" type="text" />
            </label>
            <label class="form-field field-full">
              {{ i18n.t('profile.position') }}
              <input formControlName="position" type="text" />
            </label>
            <label class="form-field field-medium">
              {{ i18n.t('profile.location') }}
              <input formControlName="location" type="text" />
            </label>
            <label class="form-field field-small">
              {{ i18n.t('profile.from') }}
              <input formControlName="startDate" type="date" />
            </label>
            <label class="form-field field-small">
              {{ i18n.t('profile.to') }}
              <input formControlName="endDate" type="date" />
            </label>
            <label class="checkbox field-small">
              <input
                formControlName="current"
                type="checkbox"
                (change)="onCurrentChange(item, $event)"
              />
              {{ i18n.t('profile.currentJob') }}
            </label>
          </div>
          <label class="form-field field-full">
            {{ i18n.t('profile.description') }}
            <textarea formControlName="description" rows="3"></textarea>
          </label>
          @if (showMetrics()) {
            <fieldset class="metrics-editor">
              <legend>{{ i18n.t('profile.metrics') }}</legend>
              @for (metric of item.controls.metrics.controls; track $index) {
                <div class="metric-row">
                  <input
                    [formControl]="metric"
                    type="text"
                    [placeholder]="i18n.t('profile.metricsPlaceholder')"
                  />
                  <button
                    type="button"
                    class="btn btn--danger btn--small"
                    (click)="removeMetric(item, $index)"
                  >
                    {{ i18n.t('profile.removeMetric') }}
                  </button>
                </div>
              }
              <button
                type="button"
                class="btn btn--secondary btn--small"
                (click)="addMetric(item)"
              >
                + {{ i18n.t('profile.addMetric') }}
              </button>
            </fieldset>
          }
        </div>
      } @empty {
        <p class="muted">{{ i18n.t('profile.emptyExperience') }}</p>
      }
    </section>
  `,
})
export class ExperienceSectionComponent {
  readonly i18n = inject(I18nService);
  readonly experiences = input.required<FormArray<ExperienceForm>>();
  readonly duplicateIndices = input<ReadonlySet<number>>(new Set());
  readonly overlapIndices = input<ReadonlySet<number>>(new Set());
  readonly showMetrics = input(true);

  add(): void {
    const index = this.experiences().length;
    this.experiences().push(newExperienceForm());
    scrollToItem('experience', index);
  }

  remove(index: number): void {
    this.experiences().removeAt(index);
  }

  addMetric(group: ExperienceForm): void {
    group.controls.metrics.push(newMetricForm());
  }

  removeMetric(group: ExperienceForm, index: number): void {
    group.controls.metrics.removeAt(index);
  }

  onCurrentChange(group: ExperienceForm, event: Event): void {
    syncEndDate(group, (event.target as HTMLInputElement).checked);
  }
}
