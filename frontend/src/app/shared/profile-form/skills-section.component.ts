import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { ReactiveFormsModule, type FormArray } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';
import {
  SKILL_LEVELS,
  newSkillForm,
  type SkillForm,
} from '../../core/profile-form';
import { scrollToItem } from './section-utils';

@Component({
  selector: 'app-skills-section',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card">
      <header class="section-header">
        <h2>{{ i18n.t('profile.skills') }}</h2>
        <button type="button" class="btn btn--secondary btn--small" (click)="add()">
          + {{ i18n.t('profile.addSkill') }}
        </button>
      </header>
      @for (item of skills().controls; track $index) {
        <div class="item compact" [formGroup]="item" [attr.id]="'skill-item-' + $index">
          @if (duplicateIndices().has($index)) {
            <span class="tag tag--duplicate">{{ i18n.t('profile.duplicate') }}</span>
          }
          <label class="form-field">
            {{ i18n.t('profile.skill') }}
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
        <p class="muted">{{ i18n.t('profile.emptySkills') }}</p>
      }
    </section>
  `,
})
export class SkillsSectionComponent {
  readonly i18n = inject(I18nService);
  readonly skills = input.required<FormArray<SkillForm>>();
  readonly duplicateIndices = input<ReadonlySet<number>>(new Set());
  readonly levels = SKILL_LEVELS;

  add(): void {
    const index = this.skills().length;
    this.skills().push(newSkillForm());
    scrollToItem('skill', index);
  }

  remove(index: number): void {
    this.skills().removeAt(index);
  }
}
