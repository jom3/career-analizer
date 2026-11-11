import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
} from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-item-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'dismissed.emit()',
  },
  template: `
    <div class="modal-backdrop" (click)="dismissed.emit()">
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        (click)="$event.stopPropagation()"
      >
        <header class="modal__head">
          <h3>{{ title() }}</h3>
        </header>
        <div class="modal__body">
          <ng-content />
        </div>
        <footer class="modal__actions">
          <button type="button" class="btn btn--secondary" (click)="dismissed.emit()">
            {{ i18n.t('common.cancel') }}
          </button>
          <button type="button" class="btn btn--primary" (click)="confirmed.emit()">
            {{ i18n.t('common.apply') }}
          </button>
        </footer>
      </div>
    </div>
  `,
  styles: [
    `
      .modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 50;
        display: grid;
        place-items: center;
        padding: var(--space-4);
        background: rgb(15 23 42 / 0.45);
      }
      .modal {
        display: flex;
        flex-direction: column;
        width: min(44rem, 100%);
        max-height: 90vh;
        background: var(--surface);
        border-radius: var(--radius-m);
        box-shadow: var(--shadow-s);
      }
      .modal__head,
      .modal__actions {
        padding: var(--space-4) var(--space-5);
      }
      .modal__head h3 {
        margin: 0;
      }
      .modal__body {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        padding: 0 var(--space-5);
        overflow-y: auto;
      }
      .modal__actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-3);
      }
    `,
  ],
})
export class ItemModalComponent {
  readonly i18n = inject(I18nService);
  readonly title = input.required<string>();
  readonly confirmed = output<void>();
  readonly dismissed = output<void>();
}
