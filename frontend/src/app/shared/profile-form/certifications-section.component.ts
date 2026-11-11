import { Component, inject, input } from '@angular/core';
import { ReactiveFormsModule, type FormArray } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';
import { ItemEditor } from '../../core/item-editor';
import {
  newCertificationForm,
  type CertificationForm,
} from '../../core/profile-form';
import { DocumentAttachComponent } from './document-attach.component';
import { FormErrorComponent } from './form-error.component';
import { ItemModalComponent } from './item-modal.component';
import { scrollToItem } from './section-utils';

@Component({
  selector: 'app-certifications-section',
  imports: [ReactiveFormsModule, DocumentAttachComponent, FormErrorComponent, ItemModalComponent],
  template: `
    <section class="card">
      <header class="section-header">
        <h2>{{ i18n.t('profile.certifications') }}</h2>
        <button type="button" class="btn btn--secondary btn--small" (click)="openNew()">
          + {{ i18n.t('profile.addCertification') }}
        </button>
      </header>
      @for (item of certifications().controls; track item; let index = $index) {
        <article class="item-card" [attr.id]="'certification-item-' + index">
          <div class="item-card__head">
            <div>
              <strong>{{ item.controls.name.value || '—' }}</strong>
              <div class="muted">{{ item.controls.issuer.value }}</div>
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
          <app-document-attach [section]="'certifications'" [item]="item" />
        </article>
      } @empty {
        <p class="muted">{{ i18n.t('profile.emptyCertifications') }}</p>
      }
      @if (editor.draft(); as draft) {
        <app-item-modal
          [title]="editor.isNew() ? i18n.t('profile.addCertification') : i18n.t('common.edit')"
          (confirmed)="confirm()"
          (dismissed)="editor.dismiss()"
        >
          <div class="form-fields" [formGroup]="draft">
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
              <span class="muted">({{ i18n.t('common.optional') }})</span>
              <input formControlName="year" type="number" min="1900" max="2100" />
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
            <app-form-error [form]="draft" section="certifications" />
          }
        </app-item-modal>
      }
    </section>
  `,
})
export class CertificationsSectionComponent {
  readonly i18n = inject(I18nService);
  readonly certifications = input.required<FormArray<CertificationForm>>();
  readonly editor = new ItemEditor<CertificationForm>();

  openNew(): void {
    this.editor.openNew(this.certifications(), () => newCertificationForm());
  }

  openEdit(index: number): void {
    this.editor.openEdit(this.certifications(), index);
  }

  confirm(): void {
    const isNew = this.editor.isNew();
    if (this.editor.confirm() && isNew) {
      scrollToItem('certification', 0);
    }
  }

  remove(index: number): void {
    this.certifications().removeAt(index);
  }
}
