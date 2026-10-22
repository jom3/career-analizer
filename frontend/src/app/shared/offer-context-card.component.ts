import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../core/i18n/i18n.service';
import type { OfferContext } from '../core/models/offer-context';

// Oferta a la que pertenece un resultado generado. Se usa en listas y detalles
// de match, CV adaptado y carta para que el usuario Reconozca el puesto.
@Component({
  selector: 'app-offer-context-card',
  imports: [RouterLink],
  template: `
    <div class="offer-context">
      <span class="offer-context__label">{{ i18n.t('offerContext.label') }}</span>
      <div class="offer-context__main">
        <strong>{{ offer().title || i18n.t('offerContext.untitled') }}</strong>
        @if (offer().company) {
          <span class="muted">{{ offer().company }}</span>
        }
        @if (!offer().saved) {
          <span class="tag">{{ i18n.t('offerContext.notSaved') }}</span>
        }
      </div>
      <div class="offer-context__actions">
        @if (offer().url) {
          <a
            class="btn-link"
            [href]="offer().url"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ i18n.t('offerContext.openPosting') }}
          </a>
        }
        @if (offer().id) {
          <a
            class="btn-link"
            routerLink="/job-analysis"
            [queryParams]="{ offer: offer().id }"
          >
            {{ i18n.t('offerContext.viewInOffers') }}
          </a>
        }
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    .offer-context {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2) var(--space-3);
      padding: var(--space-3) var(--space-4);
      background: var(--surface);
      border: 1px solid var(--rule);
      border-radius: var(--radius-s);
    }

    .offer-context__label {
      font-size: var(--fs-small);
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .offer-context__main {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--space-2);
      min-width: 0;
    }

    .offer-context__main strong {
      overflow-wrap: anywhere;
    }

    .offer-context__actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3);
      margin-left: auto;
    }
  `,
})
export class OfferContextCardComponent {
  readonly i18n = inject(I18nService);
  readonly offer = input.required<OfferContext>();
}
