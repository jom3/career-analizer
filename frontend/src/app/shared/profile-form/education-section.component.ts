import { Component, inject, input } from '@angular/core';
import { ReactiveFormsModule, type FormArray } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';
import { ItemEditor } from '../../core/item-editor';
import {
  newEducationForm,
  syncEndDate,
  type EducationForm,
} from '../../core/profile-form';
import { DocumentAttachComponent } from './document-attach.component';
import { FormErrorComponent } from './form-error.component';
import { ItemModalComponent } from './item-modal.component';
import { scrollToItem } from './section-utils';

@Component({
  selector: 'app-education-section',
  imports: [ReactiveFormsModule, DocumentAttachComponent, FormErrorComponent, ItemModalComponent],
  template: `
    <section class="card">
      <header class="section-header">
        <h2>{{ i18n.t('profile.education') }}</h2>
        <button type="button" class="btn btn--secondary btn--small" (click)="openNew()">
          + {{ i18n.t('profile.addEducation') }}
        </button>
      </header>
      @for (item of education().controls; track item; let index = $index) {
        <article class="item-card" [attr.id]="'education-item-' + index">
          <div class="item-card__head">
            <div>
              <strong>{{ item.controls.degree.value || '—' }}</strong>
              <div class="muted">{{ item.controls.institution.value }}</div>
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
          <app-document-attach [section]="'education'" [item]="item" />
        </article>
      } @empty {
        <p class="muted">{{ i18n.t('profile.emptyEducation') }}</p>
      }
      @if (editor.draft(); as draft) {
        <app-item-modal
          [title]="editor.isNew() ? i18n.t('profile.addEducation') : i18n.t('common.edit')"
          (confirmed)="confirm()"
          (dismissed)="editor.dismiss()"
        >
          <div class="form-fields" [formGroup]="draft">
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
                (change)="onCurrentChange(draft, $event)"
              />
              {{ i18n.t('profile.inProgress') }}
            </label>
            <label class="form-field field-full">
              {{ i18n.t('profile.description') }}
              <textarea formControlName="description" rows="3"></textarea>
            </label>
            <label class="checkbox field-medium">
              <input formControlName="showInCompactCv" type="checkbox" />
              {{ i18n.t('profile.showInCompactCv') }}
            </label>
            <label class="checkbox field-medium">
              <input formControlName="showInDocumentedCv" type="checkbox" />
              {{ i18n.t('profile.showInDocumentedCv') }}
            </label>
          </div>
          @if (editor.invalid()) {
            <app-form-error [form]="draft" section="education" />
          }
        </app-item-modal>
      }
    </section>
  `,
})
export class EducationSectionComponent {
  readonly i18n = inject(I18nService);
  readonly education = input.required<FormArray<EducationForm>>();
  readonly editor = new ItemEditor<EducationForm>();

  openNew(): void {
    this.editor.openNew(this.education(), () => newEducationForm());
  }

  openEdit(index: number): void {
    this.editor.openEdit(this.education(), index);
  }

  confirm(): void {
    const isNew = this.editor.isNew();
    if (this.editor.confirm() && isNew) {
      scrollToItem('education', 0);
    }
  }

  remove(index: number): void {
    this.education().removeAt(index);
  }

  onCurrentChange(group: EducationForm, event: Event): void {
    syncEndDate(group, (event.target as HTMLInputElement).checked);
  }
}
