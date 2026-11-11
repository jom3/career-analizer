import { Component, inject, input } from '@angular/core';
import { ReactiveFormsModule, type FormArray } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';
import { ItemEditor } from '../../core/item-editor';
import {
  SKILL_LEVELS,
  newSkillForm,
  type SkillForm,
} from '../../core/profile-form';
import { FormErrorComponent } from './form-error.component';
import { ItemModalComponent } from './item-modal.component';
import { scrollToItem } from './section-utils';

@Component({
  selector: 'app-skills-section',
  imports: [ReactiveFormsModule, FormErrorComponent, ItemModalComponent],
  template: `
    <section class="card">
      <header class="section-header">
        <h2>{{ i18n.t('profile.skills') }}</h2>
        <button type="button" class="btn btn--secondary btn--small" (click)="openNew()">
          + {{ i18n.t('profile.addSkill') }}
        </button>
      </header>
      @for (item of skills().controls; track item; let index = $index) {
        <article class="item-card" [attr.id]="'skill-item-' + index">
          <div class="item-card__head">
            <div>
              <strong>{{ item.controls.name.value || '—' }}</strong>
              <span class="muted">· {{ item.controls.level.value }}</span>
              @if (duplicateIndices().has(index)) {
                <span class="tag tag--duplicate">{{ i18n.t('profile.duplicate') }}</span>
              }
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
        <p class="muted">{{ i18n.t('profile.emptySkills') }}</p>
      }
      @if (editor.draft(); as draft) {
        <app-item-modal
          [title]="editor.isNew() ? i18n.t('profile.addSkill') : i18n.t('common.edit')"
          (confirmed)="confirm()"
          (dismissed)="editor.dismiss()"
        >
          <div class="form-fields" [formGroup]="draft">
            <label class="form-field field-full">
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
          </div>
          @if (editor.invalid()) {
            <app-form-error [form]="draft" section="skills" />
          }
        </app-item-modal>
      }
    </section>
  `,
})
export class SkillsSectionComponent {
  readonly i18n = inject(I18nService);
  readonly skills = input.required<FormArray<SkillForm>>();
  readonly duplicateIndices = input<ReadonlySet<number>>(new Set());
  readonly levels = SKILL_LEVELS;
  readonly editor = new ItemEditor<SkillForm>();

  openNew(): void {
    this.editor.openNew(this.skills(), () => newSkillForm());
  }

  openEdit(index: number): void {
    this.editor.openEdit(this.skills(), index);
  }

  confirm(): void {
    const isNew = this.editor.isNew();
    if (this.editor.confirm() && isNew) {
      scrollToItem('skill', 0);
    }
  }

  remove(index: number): void {
    this.skills().removeAt(index);
  }
}
