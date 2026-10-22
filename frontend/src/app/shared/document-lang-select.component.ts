import { Component, inject, model } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';

export type DocumentLang = 'es' | 'en';

// Idioma del documento generado, independiente del idioma de la interfaz.
// Arranca en el idioma activo de la UI para no agregar fricción.
@Component({
  selector: 'app-document-lang-select',
  template: `
    <label class="doc-lang">
      <span>{{ i18n.t('documentLang.label') }}</span>
      <select
        [value]="value()"
        (change)="value.set($any($event.target).value)"
      >
        <option value="es">{{ i18n.t('documentLang.es') }}</option>
        <option value="en">{{ i18n.t('documentLang.en') }}</option>
      </select>
    </label>
  `,
  styles: `
    .doc-lang {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--fs-small);
      color: var(--muted);
    }
  `,
})
export class DocumentLangSelectComponent {
  readonly i18n = inject(I18nService);
  readonly value = model<DocumentLang>(this.i18n.lang());
}
