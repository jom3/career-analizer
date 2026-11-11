import { Component, inject, input, signal } from '@angular/core';
import type { FormControl } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';
import {
  ProfileService,
  type DocumentSection,
} from '../../core/profile.service';
import {
  DOCUMENT_ACCEPT,
  isWithinProfileFileLimit,
} from '../../core/profile-files';

export interface DocumentAttachItem {
  controls: {
    id: FormControl<string | null>;
    documentName: FormControl<string>;
  };
}

@Component({
  selector: 'app-document-attach',
  template: `
    <div class="document-attach">
      @if (!itemId()) {
        <p class="muted">{{ i18n.t('profile.documentSaveFirst') }}</p>
      } @else {
        @if (documentName()) {
          <a
            class="document-attach__link"
            [href]="documentUrl()"
            target="_blank"
            rel="noopener"
          >
            {{ documentName() }}
          </a>
          <label class="btn btn--secondary btn--small">
            {{ i18n.t('profile.replaceDocument') }}
            <input
              class="visually-hidden"
              type="file"
              [accept]="accept"
              [disabled]="busy()"
              (change)="onFileSelected($event)"
            />
          </label>
          <button
            type="button"
            class="btn btn--danger btn--small"
            [disabled]="busy()"
            (click)="onRemove()"
          >
            {{ i18n.t('profile.removeDocument') }}
          </button>
        } @else {
          <label class="btn btn--secondary btn--small">
            {{ busy() ? i18n.t('profile.uploading') : i18n.t('profile.attachDocument') }}
            <input
              class="visually-hidden"
              type="file"
              [accept]="accept"
              [disabled]="busy()"
              (change)="onFileSelected($event)"
            />
          </label>
          <span class="muted">{{ i18n.t('profile.documentHint') }}</span>
        }
      }
      @if (error()) {
        <p class="alert alert--error" role="alert">{{ error() }}</p>
      }
    </div>
  `,
  styles: [
    `
      .document-attach {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
      }
      .document-attach__link {
        color: var(--accent);
        font-size: var(--fs-small);
        word-break: break-all;
      }
    `,
  ],
})
export class DocumentAttachComponent {
  readonly i18n = inject(I18nService);
  private readonly profileService = inject(ProfileService);

  readonly section = input.required<DocumentSection>();
  readonly item = input.required<DocumentAttachItem>();

  readonly accept = DOCUMENT_ACCEPT;
  readonly busy = signal(false);
  readonly error = signal('');

  itemId(): string | null {
    return this.item().controls.id.value;
  }

  documentName(): string {
    return this.item().controls.documentName.value;
  }

  documentUrl(): string {
    return this.profileService.documentUrl(this.section(), this.itemId() ?? '');
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const id = this.itemId();
    if (!file || !id) {
      return;
    }
    if (!isWithinProfileFileLimit(file)) {
      this.error.set(this.i18n.t('profile.fileTooLarge'));
      return;
    }
    await this.run(async () => {
      const uploaded = await this.profileService.uploadDocument(
        this.section(),
        id,
        file,
      );
      this.item().controls.documentName.setValue(uploaded.documentName);
    });
  }

  async onRemove(): Promise<void> {
    const id = this.itemId();
    if (!id) {
      return;
    }
    await this.run(async () => {
      await this.profileService.deleteDocument(this.section(), id);
      this.item().controls.documentName.setValue('');
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
    } catch {
      this.error.set(this.i18n.t('profile.fileError'));
    } finally {
      this.busy.set(false);
    }
  }
}
