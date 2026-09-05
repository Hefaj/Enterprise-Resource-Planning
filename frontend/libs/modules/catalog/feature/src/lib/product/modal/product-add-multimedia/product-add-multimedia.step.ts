import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';

import {
  ErpBatchStepBase,
  ErpFileUploadListBuilder,
  ErpFileUploadListComponent,
  ErpFileUploadListConfig,
  ErpFileUploadListItem,
  ErpTranslatePipe,
} from '@erp/shared/ui';
import {
  BatchCommandOfProductAddMultimediaCommandAndSearchProductRequest,
  CatalogMultimediaOrchestrator,
} from '@erp/catalog/data-access';
import { PRODUCT_KEYS } from '../../translation';

/**
 * Wybór plików do dopięcia produktom.
 *
 * Wybór/postęp/lista/błędy renderuje wspólny port `erp-file-upload-list` (shared/ui). Ten
 * komponent zostaje adapterem domenowym: dostarcza bilet uploadu (`CatalogMultimediaOrchestrator`)
 * i zapisuje wynikowe uuid do `templateCommand`.
 *
 * <b>Pliki wgrywają się od razu po wybraniu, a nie przy zapisie</b> — i to jest tu jedyna
 * nieoczywista decyzja. Powód: transfer trwa tyle, ile trwa łącze użytkownika, więc schowany
 * za przyciskiem „Zapisz" zamieniłby go w zawieszony modal bez informacji zwrotnej. Wgrywanie
 * przy wyborze daje postęp w miejscu, w którym użytkownik i tak patrzy, a sam zapis zostaje
 * tym, czym powinien być: zleceniem operacji masowej, które wraca natychmiast. Ta sama decyzja
 * co w załącznikach zgłoszenia (Task Management) i z tego samego powodu.
 *
 * Cena tej decyzji: pliki wgrane do modalu zamkniętego bez zapisu zostają w katalogu jako
 * zasoby nieprzypisane do żadnego produktu. Sprzątanie takich sierot nie jest jeszcze
 * zaimplementowane (patrz `docs/guides/backend/exports-artifacts.md` §9).
 */
@Component({
  selector: 'erp-catalog-product-add-multimedia-step',
  standalone: true,
  imports: [ErpFileUploadListComponent, ErpTranslatePipe],
  template: `
    <div class="flex flex-col gap-3">
      <p class="text-sm" style="color: var(--tui-text-secondary)">
        @if (isFilterMode()) {
          {{ keys.filterModeHint | erpTranslate }}
        } @else {
          {{ keys.targetSummary | erpTranslate: { count: targetCount() } }}
        }
      </p>

      <erp-file-upload-list [config]="uploadListConfig()" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductAddMultimediaStepComponent
  extends ErpBatchStepBase<BatchCommandOfProductAddMultimediaCommandAndSearchProductRequest> {
  protected readonly keys = PRODUCT_KEYS.commands.addMultimedia;

  private readonly multimediaOrchestrator = inject(CatalogMultimediaOrchestrator);

  protected readonly _items = signal<readonly ErpFileUploadListItem[]>([]);

  /**
   * Zapis wolno puścić dopiero, gdy pliki są w magazynie ORAZ operacja ma cel. Bez tego
   * pierwszego backend odrzuciłby komendę bez ani jednego zasobu, bez drugiego — zadanie
   * bez celów, komunikatem „Brak komend do wykonania".
   */
  private readonly canGoNext = computed(
    () => this._items().length > 0
      && (this.isFilterMode() || this.targetUuids().length > 0),
  );

  protected readonly uploadListConfig = computed<ErpFileUploadListConfig>(() =>
    ErpFileUploadListBuilder.create((b) =>
      b
        .setItems(this._items())
        .setCanEdit(true)
        .setAddLabel(this.keys.label)
        .setEmptyLabel(this.keys.empty)
        .setUploadingLabel((uploaded, total) => ({ key: this.keys.uploadProgress, params: { uploaded, total } }))
        .setUploadFailedLabel(this.keys.uploadFailed)
        .setOnUpload((files, onProgress) => this._uploadAsync(files, onProgress)),
    ),
  );

  public constructor() {
    super();

    effect(() => this.registerCanGoNext()?.(this.canGoNext));
  }

  private async _uploadAsync(files: readonly File[], onProgress: (uploaded: number) => void): Promise<void> {
    this._items.set([]);
    this.writeToCommand([]);

    const uuids = await this.multimediaOrchestrator.uploadFilesAsync(files, onProgress);

    this._items.set(files.map((file, index) => ({
      id: uuids[index],
      fileName: file.name,
      fileSize: file.size,
      isImage: file.type.startsWith('image/'),
    })));
    this.writeToCommand(uuids);
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
