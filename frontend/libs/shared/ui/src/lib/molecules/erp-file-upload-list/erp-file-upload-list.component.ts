import { ChangeDetectionStrategy, Component, computed, effect, input, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { TuiIcon } from '@taiga-ui/core';
import { TuiFileLike, TuiFiles } from '@taiga-ui/kit';

import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpButtonComponent } from '../../atoms/erp-button';
import { ErpButtonConfig } from '../../atoms/erp-button/erp-button.types';
import { ErpFileUploadListConfig, ErpFileUploadListItem } from './erp-file-upload-list.types';

/**
 * Port uploadu niezależny od domeny: wybór plików, postęp, lista, błędy i (dla obrazów) podgląd.
 *
 * Komponent NIE zna bajtów ani tego, czym jest „upload" dla wywołującego — woła
 * `config().onUpload(files, onProgress)` i sam trzyma tylko UI-owy stan transferu. Ta sama
 * potrzeba istniała osobno w Catalogu (`ProductAddMultimediaStepComponent`) i w Task Management
 * (`IssueAttachmentsComponent`) — to miejsce zbiera ją w jednym porcie.
 *
 * Natywny `<input tuiInputFiles>` jest tu jedynym miejscem w systemie, gdzie ten element ma
 * żyć — TaigaUI `TuiFiles` wymaga go jako hosta dyrektywy. Moduły domenowe nie odtwarzają go
 * lokalnie, tylko konsumują ten komponent.
 */
@Component({
  selector: 'erp-file-upload-list',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, TuiFiles, TuiIcon, ErpButtonComponent, ErpTranslatePipe],
  template: `
    <div class="flex flex-col gap-2">
      @if (_canEdit()) {
        <label tuiInputFiles>
          <input
            tuiInputFiles
            [multiple]="_multiple()"
            [accept]="_accept()"
            [formControl]="filesControl"
            [attr.aria-label]="_addLabel() | erpTranslate"
          />
        </label>
      }

      @if (_uploading()) {
        <p class="m-0 text-sm text-[var(--tui-text-secondary)]">
          {{ _uploadingLabel() | erpTranslate }}
        </p>
      } @else if (_tooManyFiles()) {
        <p class="m-0 text-sm text-[var(--tui-status-negative)]">
          {{ _tooManyFilesLabel() | erpTranslate }}
        </p>
      } @else if (_failed()) {
        <p class="m-0 text-sm text-[var(--tui-status-negative)]">
          {{ _uploadFailedLabel() | erpTranslate }}
        </p>
      }

      @if (_items().length === 0) {
        <p class="m-0 text-sm text-[var(--tui-text-secondary)]">
          {{ _emptyLabel() | erpTranslate }}
        </p>
      } @else {
        <ul class="m-0 flex list-none flex-wrap gap-3 p-0">
          @for (item of _items(); track item.id) {
            <li class="flex w-72 items-center gap-3 rounded border border-[var(--tui-border-normal)] p-2">
              @if (item.isImage) {
                <button
                  type="button"
                  class="h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded border-0 bg-[var(--tui-background-neutral-1)] p-0"
                  [disabled]="!config().onPreview"
                  [attr.aria-label]="_previewLabel() | erpTranslate"
                  (click)="config().onPreview?.(item)"
                >
                  @if (item.previewUrl?.()) {
                    <img [src]="item.previewUrl!()" [alt]="item.fileName" class="h-full w-full object-cover" />
                  }
                </button>
              } @else {
                <span
                  class="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-[var(--tui-background-neutral-1)] text-[var(--tui-text-secondary)]"
                  aria-hidden="true"
                >
                  <tui-icon icon="@tui.file" />
                </span>
              }

              <div class="flex min-w-0 flex-1 flex-col">
                <span class="truncate text-sm" [title]="item.fileName">{{ item.fileName }}</span>
                <span class="text-xs text-[var(--tui-text-secondary)]">
                  {{ formatSize(item.fileSize) }}
                  @if (item.createdAt) {
                    · {{ item.createdAt | date: 'short' }}
                  }
                </span>
              </div>

              @if (config().onDownload) {
                <erp-button [config]="downloadButton(item)" />
              }
              @if (_canEdit() && config().onRemove) {
                <erp-button [config]="removeButton(item)" />
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpFileUploadListComponent {
  public readonly config = input.required<ErpFileUploadListConfig>();

  protected readonly filesControl = new FormControl<TuiFileLike | readonly TuiFileLike[] | null>(null);

  private readonly _selection = toSignal(this.filesControl.valueChanges, { initialValue: null });

  protected readonly _uploading = signal(false);
  private readonly _uploaded = signal(0);
  private readonly _total = signal(0);
  protected readonly _failed = signal(false);
  protected readonly _tooManyFiles = signal(false);

  protected readonly _items = computed(() => unwrapSignal(this.config().items) ?? []);
  protected readonly _canEdit = computed(() => unwrapSignal(this.config().canEdit) ?? false);
  protected readonly _multiple = computed(() => unwrapSignal(this.config().multiple) ?? true);
  protected readonly _accept = computed(() => unwrapSignal(this.config().accept) ?? '');
  protected readonly _addLabel = computed(() => unwrapSignal(this.config().addLabel) ?? '');
  protected readonly _emptyLabel = computed(() => unwrapSignal(this.config().emptyLabel) ?? '');
  protected readonly _previewLabel = computed(() => unwrapSignal(this.config().previewLabel));
  protected readonly _uploadFailedLabel = computed(() => unwrapSignal(this.config().uploadFailedLabel) ?? '');
  protected readonly _tooManyFilesLabel = computed(() => unwrapSignal(this.config().tooManyFilesLabel));
  protected readonly _uploadingLabel = computed(() => this.config().uploadingLabel(this._uploaded(), this._total()));

  public constructor() {
    effect(() => {
      const selection = this._selection();
      const files = selection === null ? [] : Array.isArray(selection) ? selection : [selection];

      // `untracked`, bo upload zapisuje sygnały, które ten sam effect obserwuje — bez tego
      // pierwszy zapis wywołałby go ponownie i puścił transfer drugi raz.
      untracked(() => void this._upload(files as File[]));
    });
  }

  protected downloadButton(item: ErpFileUploadListItem): ErpButtonConfig {
    return {
      label: '',
      appearance: 'flat',
      size: 'xs',
      iconStart: '@tui.download',
      ariaLabel: this.config().downloadLabel,
      fn: () => this.config().onDownload?.(item),
    };
  }

  protected removeButton(item: ErpFileUploadListItem): ErpButtonConfig {
    return {
      label: '',
      appearance: 'flat',
      size: 'xs',
      iconStart: '@tui.trash',
      ariaLabel: this.config().removeLabel,
      fn: () => this.config().onRemove?.(item),
    };
  }

  protected formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    const units = ['KB', 'MB', 'GB'];
    let value = bytes / 1024;
    let unit = 0;

    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit++;
    }

    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
  }

  private async _upload(files: readonly File[]): Promise<void> {
    if (files.length === 0) {
      return;
    }

    const max = this.config().maxFilesPerSelection;
    if (max !== undefined && files.length > max) {
      this._tooManyFiles.set(true);
      this.filesControl.setValue(null, { emitEvent: false });
      return;
    }

    this._uploading.set(true);
    this._failed.set(false);
    this._tooManyFiles.set(false);
    this._uploaded.set(0);
    this._total.set(files.length);

    try {
      await this.config().onUpload(files, (uploaded) => this._uploaded.set(uploaded));
    } catch (error) {
      console.error('[ErpFileUploadListComponent] Upload nie powiódł się.', error);
      this._failed.set(true);
    } finally {
      this._uploading.set(false);
      // Wybór czyścimy zawsze: lista pod spodem pokazuje już stan faktyczny po stronie domeny,
      // a zostawiony wgrałby te same pliki jeszcze raz przy następnej zmianie kontrolki.
      this.filesControl.setValue(null, { emitEvent: false });
    }
  }
}
