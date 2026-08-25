import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TuiFileLike, TuiFiles } from '@taiga-ui/kit';
import { toSignal } from '@angular/core/rxjs-interop';

import { ErpBatchStepBase, ErpTranslatePipe } from '@erp/shared/ui';
import {
  BatchCommandOfProductAddMultimediaCommandAndSearchProductRequest,
  CatalogMultimediaOrchestrator,
} from '@erp/catalog/data-access';
import { PRODUCT_KEYS } from '../../translation';

/**
 * Wybór plików do dopięcia produktom.
 *
 * <b>Pliki wgrywają się od razu po wybraniu, a nie przy zapisie</b> — i to jest tu jedyna
 * nieoczywista decyzja. Powód: transfer trwa tyle, ile trwa łącze użytkownika, więc schowany
 * za przyciskiem „Zapisz" zamieniłby go w zawieszony modal bez informacji zwrotnej. Wgrywanie
 * przy wyborze daje postęp w miejscu, w którym użytkownik i tak patrzy, a sam zapis zostaje
 * tym, czym powinien być: zleceniem operacji masowej, które wraca natychmiast.
 *
 * Cena tej decyzji: pliki wgrane do modalu zamkniętego bez zapisu zostają w katalogu jako
 * zasoby nieprzypisane do żadnego produktu. Sprzątanie takich sierot nie jest jeszcze
 * zaimplementowane (patrz `docs/backend/exports-artifacts.md` §9).
 */
@Component({
  selector: 'erp-catalog-product-add-multimedia-step',
  standalone: true,
  imports: [ReactiveFormsModule, TuiFiles, ErpTranslatePipe],
  template: `
    <div class="flex flex-col gap-3">
      <p class="text-sm" style="color: var(--tui-text-secondary)">
        @if (isFilterMode()) {
          {{ keys.filterModeHint | erpTranslate }}
        } @else {
          {{ keys.targetSummary | erpTranslate: { count: targetCount() } }}
        }
      </p>

      <label tuiInputFiles>
        <input
          tuiInputFiles
          multiple
          [formControl]="filesControl"
          [attr.aria-label]="keys.label | erpTranslate"
        />
      </label>

      @if (_files().length > 0) {
        <tui-files>
          @for (file of _files(); track file.name) {
            <tui-file [file]="file" [state]="_uploading() ? 'loading' : 'normal'" [showDelete]="false" />
          }
        </tui-files>
      }

      @if (_uploading()) {
        <p class="text-sm" style="color: var(--tui-text-secondary)">
          {{ keys.uploadProgress | erpTranslate: { uploaded: _uploaded(), total: _files().length } }}
        </p>
      } @else if (_failed()) {
        <p class="text-sm" style="color: var(--tui-status-negative)">
          {{ keys.uploadFailed | erpTranslate }}
        </p>
      } @else if (_uploadedUuids().length > 0) {
        <p class="text-sm" style="color: var(--tui-text-secondary)">
          {{ keys.readyHint | erpTranslate }}
        </p>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductAddMultimediaStepComponent
  extends ErpBatchStepBase<BatchCommandOfProductAddMultimediaCommandAndSearchProductRequest> {
  protected readonly keys = PRODUCT_KEYS.commands.addMultimedia;

  protected readonly filesControl = new FormControl<TuiFileLike | readonly TuiFileLike[] | null>(null);

  private readonly multimediaOrchestrator = inject(CatalogMultimediaOrchestrator);

  private readonly selection = toSignal(this.filesControl.valueChanges, { initialValue: null });

  protected readonly _files = signal<readonly File[]>([]);
  protected readonly _uploading = signal(false);
  protected readonly _uploaded = signal(0);
  protected readonly _failed = signal(false);
  protected readonly _uploadedUuids = signal<readonly string[]>([]);

  /**
   * Zapis wolno puścić dopiero, gdy pliki są w magazynie ORAZ operacja ma cel. Bez tego
   * pierwszego backend odrzuciłby komendę bez ani jednego zasobu, bez drugiego — zadanie
   * bez celów, komunikatem „Brak komend do wykonania".
   */
  private readonly canGoNext = computed(
    () => !this._uploading()
      && this._uploadedUuids().length > 0
      && (this.isFilterMode() || this.targetUuids().length > 0),
  );

  public constructor() {
    super();

    effect(() => {
      const files = this.selection();
      const list = files === null ? [] : Array.isArray(files) ? files : [files];

      // `untracked`, bo wgrywanie zapisuje sygnały, które ten sam effect by obserwował —
      // bez tego pierwszy `set` wywołałby go ponownie i puścił transfer drugi raz.
      untracked(() => this.upload(list as File[]));
    });

    effect(() => this.registerCanGoNext()?.(this.canGoNext));
  }

  private async upload(files: readonly File[]): Promise<void> {
    this._files.set(files);
    this._uploaded.set(0);
    this._failed.set(false);
    this._uploadedUuids.set([]);
    this.writeToCommand([]);

    if (files.length === 0) {
      return;
    }

    this._uploading.set(true);

    try {
      const uuids = await this.multimediaOrchestrator.uploadFilesAsync(
        files,
        uploaded => this._uploaded.set(uploaded),
      );

      this._uploadedUuids.set(uuids);
      this.writeToCommand(uuids);
    } catch {
      // Treść błędu poszła już do `errors` orkiestratora; krok pokazuje komunikat i zostawia
      // użytkownikowi możliwość wybrania plików jeszcze raz.
      this._failed.set(true);
    } finally {
      this._uploading.set(false);
    }
  }

  /**
   * Zasoby jadą w `templateCommand`, a nie w liście komend: ta sama paczka plików ma trafić
   * do KAŻDEGO celu, a uuid produktu dokłada backend przy materializacji szablonu.
   */
  private writeToCommand(multimediaUuids: readonly string[]): void {
    this.command().update(cmd => ({
      ...cmd,
      templateCommand: { multimediaUuids: [...multimediaUuids] },
    }));
  }
}
