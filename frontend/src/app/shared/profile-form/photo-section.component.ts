import {
  ChangeDetectionStrategy,
  Component,
  inject,
  model,
  signal,
} from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { ProfileService } from '../../core/profile.service';
import {
  isWithinProfileFileLimit,
  PHOTO_ACCEPT,
} from '../../core/profile-files';

@Component({
  selector: 'app-photo-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card photo-section">
      <header class="section-header">
        <h2>{{ i18n.t('profile.photoTitle') }}</h2>
      </header>
      <div class="photo-section__body">
        @if (hasPhoto()) {
          <img
            class="photo-section__preview"
            [src]="photoSrc()"
            [alt]="i18n.t('profile.photoAlt')"
          />
        } @else {
          <p class="muted">{{ i18n.t('profile.photoEmpty') }}</p>
        }
        <div class="photo-section__actions">
          <label class="btn btn--secondary btn--small">
            {{ busy() ? i18n.t('profile.uploading') : hasPhoto() ? i18n.t('profile.photoReplace') : i18n.t('profile.photoUpload') }}
            <input
              class="visually-hidden"
              type="file"
              [accept]="accept"
              [disabled]="busy()"
              (change)="onFileSelected($event)"
            />
          </label>
          @if (hasPhoto()) {
            <button
              type="button"
              class="btn btn--danger btn--small"
              [disabled]="busy()"
              (click)="onRemove()"
            >
              {{ i18n.t('profile.photoRemove') }}
            </button>
          }
          <span class="muted">{{ i18n.t('profile.photoHint') }}</span>
        </div>
        @if (error()) {
          <p class="alert alert--error" role="alert">{{ error() }}</p>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .photo-section__body {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .photo-section__preview {
        width: 6rem;
        height: 7rem;
        object-fit: cover;
        border-radius: var(--radius-s);
        border: 1px solid var(--rule);
      }
      .photo-section__actions {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        flex-wrap: wrap;
      }
    `,
  ],
})
export class PhotoSectionComponent {
  readonly i18n = inject(I18nService);
  private readonly profileService = inject(ProfileService);

  readonly hasPhoto = model.required<boolean>();

  readonly accept = PHOTO_ACCEPT;
  readonly busy = signal(false);
  readonly error = signal('');
  private readonly version = signal(0);

  photoSrc(): string {
    return `${this.profileService.photoUrl()}?v=${this.version()}`;
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    if (!isWithinProfileFileLimit(file)) {
      this.error.set(this.i18n.t('profile.fileTooLarge'));
      return;
    }
    await this.run(async () => {
      await this.profileService.uploadPhoto(file);
      this.version.update((value) => value + 1);
      this.hasPhoto.set(true);
    });
  }

  async onRemove(): Promise<void> {
    await this.run(async () => {
      await this.profileService.deletePhoto();
      this.hasPhoto.set(false);
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
