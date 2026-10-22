import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { ReactiveFormsModule, type FormArray } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';
import {
  newMetricForm,
  newProjectForm,
  type ProjectForm,
} from '../../core/profile-form';
import { scrollToItem } from './section-utils';

@Component({
  selector: 'app-projects-section',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card">
      <header class="section-header">
        <h2>{{ i18n.t('profile.projects') }}</h2>
        <button type="button" class="btn btn--secondary btn--small" (click)="add()">
          + {{ i18n.t('profile.addProject') }}
        </button>
      </header>
      @for (item of projects().controls; track $index) {
        <div class="item" [formGroup]="item" [attr.id]="'project-item-' + $index">
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
                    [placeholder]="i18n.t('profile.projectMetricsPlaceholder')"
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
        <p class="muted">{{ i18n.t('profile.emptyProjects') }}</p>
      }
    </section>
  `,
})
export class ProjectsSectionComponent {
  readonly i18n = inject(I18nService);
  readonly projects = input.required<FormArray<ProjectForm>>();
  readonly showMetrics = input(true);

  add(): void {
    const index = this.projects().length;
    this.projects().push(newProjectForm());
    scrollToItem('project', index);
  }

  remove(index: number): void {
    this.projects().removeAt(index);
  }

  addMetric(group: ProjectForm): void {
    group.controls.metrics.push(newMetricForm());
  }

  removeMetric(group: ProjectForm, index: number): void {
    group.controls.metrics.removeAt(index);
  }
}
