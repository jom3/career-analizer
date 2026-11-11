import { Component, inject, input } from '@angular/core';
import { ReactiveFormsModule, type FormArray } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';
import { ItemEditor } from '../../core/item-editor';
import {
  MAX_METRICS,
  newMetricForm,
  newProjectForm,
  type ProjectForm,
} from '../../core/profile-form';
import { FormErrorComponent } from './form-error.component';
import { ItemModalComponent } from './item-modal.component';
import { scrollToItem } from './section-utils';

@Component({
  selector: 'app-projects-section',
  imports: [ReactiveFormsModule, FormErrorComponent, ItemModalComponent],
  template: `
    <section class="card">
      <header class="section-header">
        <h2>{{ i18n.t('profile.projects') }}</h2>
        <button type="button" class="btn btn--secondary btn--small" (click)="openNew()">
          + {{ i18n.t('profile.addProject') }}
        </button>
      </header>
      @for (item of projects().controls; track item; let index = $index) {
        <article class="item-card" [attr.id]="'project-item-' + index">
          <div class="item-card__head">
            <div>
              <strong>{{ item.controls.name.value || '—' }}</strong>
              <div class="muted">{{ item.controls.role.value }}</div>
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
        <p class="muted">{{ i18n.t('profile.emptyProjects') }}</p>
      }
      @if (editor.draft(); as draft) {
        <app-item-modal
          [title]="editor.isNew() ? i18n.t('profile.addProject') : i18n.t('common.edit')"
          (confirmed)="confirm()"
          (dismissed)="editor.dismiss()"
        >
          <div class="form-fields" [formGroup]="draft">
            <label class="form-field field-full">
              {{ i18n.t('profile.projectName') }}
              <input formControlName="name" type="text" />
            </label>
            <label class="form-field field-medium">
              {{ i18n.t('profile.role') }}
              <input formControlName="role" type="text" />
            </label>
            <label class="form-field field-medium">
              {{ i18n.t('profile.url') }}
              <input formControlName="url" type="url" />
            </label>
            <label class="form-field field-wide">
              {{ i18n.t('profile.techStack') }}
              <input formControlName="techStack" type="text" />
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
                    [placeholder]="i18n.t('profile.projectMetricsPlaceholder')"
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
            <app-form-error [form]="draft" section="projects" />
          }
        </app-item-modal>
      }
    </section>
  `,
})
export class ProjectsSectionComponent {
  readonly i18n = inject(I18nService);
  readonly projects = input.required<FormArray<ProjectForm>>();
  readonly showMetrics = input(true);
  readonly editor = new ItemEditor<ProjectForm>();

  openNew(): void {
    this.editor.openNew(this.projects(), () => newProjectForm());
  }

  openEdit(index: number): void {
    this.editor.openEdit(this.projects(), index);
  }

  confirm(): void {
    const isNew = this.editor.isNew();
    if (this.editor.confirm() && isNew) {
      scrollToItem('project', 0);
    }
  }

  remove(index: number): void {
    this.projects().removeAt(index);
  }

  addMetric(group: ProjectForm): void {
    if (!this.canAddMetric(group)) {
      return;
    }
    group.controls.metrics.push(newMetricForm());
  }

  canAddMetric(group: ProjectForm): boolean {
    return group.controls.metrics.length < MAX_METRICS;
  }

  removeMetric(group: ProjectForm, index: number): void {
    group.controls.metrics.removeAt(index);
  }
}
