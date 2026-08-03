import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiIcon, TuiButton, TuiHint } from '@taiga-ui/core';
import { ErpTranslatePipe, unwrapSignal } from '@erp/shared/ui';
import { ErpMediaThumbnailConfig, MediaType } from './erp-media-thumbnail.types';

@Component({
  selector: 'erp-media-thumbnail',
  standalone: true,
  imports: [CommonModule, TuiIcon, TuiButton, ErpTranslatePipe, TuiHint],
  template: `
    <div
      class="erp-media-thumbnail"
      [class.erp-media-thumbnail--selected]="_selected()"
    >
      <!-- Zaznaczenie checkbox (symulowane) -->
      <div 
        class="erp-media-thumbnail__checkbox"
        [class.erp-media-thumbnail__checkbox--checked]="_selected()"
        (click)="onSelectToggle($event)"
      >
        @if (_selected()) {
          <tui-icon icon="@tui.check" class="erp-media-thumbnail__checkbox-icon" />
        }
      </div>

      <!-- Podgląd / Ikona -->
      <div class="erp-media-thumbnail__preview" (click)="onPreviewClick()">
        @if (_thumbnailUrl()) {
          <img [src]="_thumbnailUrl()" [alt]="(_fileName() | erpTranslate) || ''" loading="lazy" class="erp-media-thumbnail__image" />
        } @else {
          <div class="erp-media-thumbnail__placeholder">
            <tui-icon [icon]="getIconForType(_mediaType())" class="erp-media-thumbnail__type-icon" />
          </div>
        }
        
        <!-- Akcje (Hover) -->
        <div class="erp-media-thumbnail__overlay">
          @if (_actions().length > 0) {
            <div class="erp-media-thumbnail__actions" (click)="$event.stopPropagation()">
              @for (action of _actions(); track action.label) {
                <button
                  tuiButton
                  type="button"
                  appearance="outline"
                  size="s"
                  [tuiHint]="(action.label | erpTranslate) || ''"
                  (click)="onActionClick(action)"
                  class="erp-media-thumbnail__action-btn"
                >
                  @if (action.icon) {
                    <tui-icon [icon]="action.icon" />
                  }
                </button>
              }
            </div>
          }
        </div>
      </div>

      <!-- Informacje (footer) -->
      <div class="erp-media-thumbnail__info" (click)="onPreviewClick()">
        <span class="erp-media-thumbnail__name" [title]="(_fileName() | erpTranslate) || ''">
          {{ (_fileName() | erpTranslate) || '' }}
        </span>
        @if (_fileSize()) {
          <span class="erp-media-thumbnail__meta">
            {{ formatBytes(_fileSize()!) }}
          </span>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .erp-media-thumbnail {
      position: relative;
      width: 140px;
      height: 180px;
      border-radius: 0.5rem;
      border: 1px solid var(--tui-border-normal);
      background: var(--tui-background-base);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
      user-select: none;
    }

    .erp-media-thumbnail--selected {
      border-color: var(--tui-border-focus);
      box-shadow: 0 0 0 1px var(--tui-border-focus);
    }

    /* Checkbox overlay */
    .erp-media-thumbnail__checkbox {
      position: absolute;
      top: 0.375rem;
      left: 0.375rem;
      width: 1.25rem;
      height: 1.25rem;
      border-radius: 0.25rem;
      border: 1px solid var(--tui-border-normal);
      background: var(--tui-background-base);
      z-index: 2;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      opacity: 0; /* Pokazuj na hover lub gdy zaznaczone */
    }

    .erp-media-thumbnail:hover .erp-media-thumbnail__checkbox,
    .erp-media-thumbnail__checkbox--checked {
      opacity: 1;
    }

    .erp-media-thumbnail__checkbox--checked {
      background: var(--tui-background-accent-1);
      border-color: var(--tui-background-accent-1);
    }

    .erp-media-thumbnail__checkbox-icon {
      color: var(--tui-text-primary-on-accent-1);
      font-size: 0.875rem;
    }

    /* Preview section */
    .erp-media-thumbnail__preview {
      flex: 1;
      position: relative;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--tui-background-neutral-1);
      overflow: hidden;
    }

    .erp-media-thumbnail__image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .erp-media-thumbnail__placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      color: var(--tui-text-secondary);
    }

    .erp-media-thumbnail__type-icon {
      font-size: 2.5rem;
    }

    /* Hover overlay actions */
    .erp-media-thumbnail__overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .erp-media-thumbnail:hover .erp-media-thumbnail__overlay {
      opacity: 1;
    }

    .erp-media-thumbnail__actions {
      display: flex;
      gap: 0.25rem;
    }

    .erp-media-thumbnail__action-btn {
      --tui-radius-m: 100px;
      color: white;
      border-color: rgba(255, 255, 255, 0.5);
    }

    .erp-media-thumbnail__action-btn:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    /* Info section (footer) */
    .erp-media-thumbnail__info {
      padding: 0.5rem;
      border-top: 1px solid var(--tui-border-normal);
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      cursor: pointer;
    }

    .erp-media-thumbnail__name {
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--tui-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .erp-media-thumbnail__meta {
      font-size: 0.625rem;
      color: var(--tui-text-secondary);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpMediaThumbnailComponent {
  public readonly config = input.required<ErpMediaThumbnailConfig>();

  protected readonly _fileName = computed(() => unwrapSignal(this.config().fileName) ?? '');
  protected readonly _thumbnailUrl = computed(() => unwrapSignal(this.config().thumbnailUrl));
  protected readonly _mediaType = computed(() => unwrapSignal(this.config().mediaType) ?? 'unknown');
  protected readonly _fileSize = computed(() => unwrapSignal(this.config().fileSize));
  protected readonly _selected = computed(() => unwrapSignal(this.config().selected) ?? false);
  protected readonly _actions = computed(() => this.config().actions ?? []);

  protected getIconForType(type: MediaType): string {
    switch (type) {
      case 'image': return '@tui.image';
      case 'video': return '@tui.video';
      case 'audio': return '@tui.music';
      case 'document': return '@tui.file-text';
      case '3d-model': return '@tui.box';
      default: return '@tui.file';
    }
  }

  protected formatBytes(bytes: number, decimals = 2): string {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }

  protected onSelectToggle(event: MouseEvent): void {
    event.stopPropagation();
    this.config().onSelect?.(this.config().uuid, !this._selected(), event.shiftKey);
  }

  protected onPreviewClick(): void {
    this.config().onPreview?.(this.config().uuid);
  }

  protected async onActionClick(action: any): Promise<void> {
    await action.onClick(this.config().uuid);
  }
}
