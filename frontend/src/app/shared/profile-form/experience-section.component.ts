import { Component, inject, input } from '@angular/core';
import { ReactiveFormsModule, type FormArray } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';
import { ItemEditor } from '../../core/item-editor';
import {
  MAX_METRICS,
  newExperienceForm,
  newMetricForm,
  syncEndDate,
  type ExperienceForm,
} from '../../core/profile-form';
import { FormErrorComponent } from './form-error.component';
import { ItemModalComponent } from './item-modal.component';
import { scrollToItem } from './section-utils';

@Component({
  selector: 'app-experience-section',
  imports: [ReactiveFormsModule, FormErrorComponent, ItemModalComponent],
  template: `
    <section class="card">
      <header class="section-header">
        <h2>{{ i18n.t('profile.experience') }}</h2>
        <button type="button" class="btn btn--secondary btn--small" (click)="openNew()">
          + {{ i18n.t('profile.addExperience') }}
        </button>
      </header>
      @for (item of experiences().controls; track item; let index = $index) {
        <article class="item-card" [attr.id]="'experience-item-' + index">
          <div class="item-card__head">
            <div>
              <strong>{{ item.controls.position.value || '—' }}</strong>
              <div class="muted">{{ item.controls.company.value }}</div>
              <div class="item-card__tags">
                @if (duplicateIndices().has(index)) {
                  <span class="tag tag--duplicate">{{ i18n.t('profile.duplicate') }}</span>
                }
                @if (overlapIndices().has(index)) {
                  <span class="tag tag--duplicate" [title]="i18n.t('profile.overlap')">
                    {{ i18n.t('profile.overlap') }}
                  </span>
                }
              </div>
            </div>
            <div class="item-card__actions">
              <button type="button" class="btn btn--secondary btn--small" (click)="openEdit(index)">
                {{ i18n.t('common.edit') }}
              </button>
              <button type="button" class="btn btn--danger btn--small" (click)="remove(index)">
                {{ i18n.t('common.delete') }}
              </button>
            </div>
          </div>
        </article>
      } @empty {
        <p class="muted">{{ i18n.t('profile.emptyExperience') }}</p>
      }
      @if (editor.draft(); as draft) {
        <app-item-modal
          [title]="editor.isNew() ? i18n.t('profile.addExperience') : i18n.t('common.edit')"
          (confirmed)="confirm()"
          (dismissed)="editor.dismiss()"
        >
          <div class="form-fields" [formGroup]="draft">
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
                (change)="onCurrentChange(draft, $event)"
              />
              {{ i18n.t('profile.currentJob') }}
            </label>
            <label class="form-field field-full">
              {{ i18n.t('profile.description') }}
              <textarea formControlName="description" rows="3"></textarea>
            </label>
          </div>
          @if (showMetrics()) {
            <fieldset class="metrics-editor">
              <legend>{{ i18n.t('profile.metrics') }}</legend>
              @for (metric of draft.controls.metrics.controls; track metric; let metricIndex = $index) {
                <div class="metric-row">
                  <input
                    [formControl]="metric"
                    type="text"
                    [placeholder]="i18n.t('profile.metricsPlaceholder')"
                  />
                  <button
                    type="button"
                    class="btn btn--danger btn--small"
                    (click)="removeMetric(draft, metricIndex)"
                  >
                    {{ i18n.t('profile.removeMetric') }}
                  </button>
                </div>
              }
              <button
                type="button"
                class="btn btn--secondary btn--small"
                (click)="addMetric(draft)"
                [disabled]="!canAddMetric(draft)"
              >
                + {{ i18n.t('profile.addMetric') }}
              </button>
              @if (!canAddMetric(draft)) {
                <p class="muted">{{ i18n.t('profile.metricsLimit') }}</p>
              }
            </fieldset>
          }
          @if (editor.invalid()) {
            <app-form-error [form]="draft" section="experiences" />
          }
        </app-item-modal>
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
  readonly editor = new ItemEditor<ExperienceForm>();

  openNew(): void {
    this.editor.openNew(this.experiences(), () => newExperienceForm());
  }

  openEdit(index: number): void {
    this.editor.openEdit(this.experiences(), index);
  }

  confirm(): void {
    const isNew = this.editor.isNew();
    if (this.editor.confirm() && isNew) {
      scrollToItem('experience', 0);
    }
  }

  remove(index: number): void {
    this.experiences().removeAt(index);
  }

  addMetric(group: ExperienceForm): void {
    if (!this.canAddMetric(group)) {
      return;
    }
    group.controls.metrics.push(newMetricForm());
  }

  canAddMetric(group: ExperienceForm): boolean {
    return group.controls.metrics.length < MAX_METRICS;
  }

  removeMetric(group: ExperienceForm, index: number): void {
    group.controls.metrics.removeAt(index);
  }

  onCurrentChange(group: ExperienceForm, event: Event): void {
    syncEndDate(group, (event.target as HTMLInputElement).checked);
  }
}
