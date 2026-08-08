import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ProductStore } from '../product.store';
import { MAX_DETAILED_SELECTION } from '@erp/catalog/util';
import { ErpActionToolbarBuilder, ErpGroupPanelBuilder, ErpGroupPanelComponent } from '@erp/shared/ui';
import { CatalogProductOrchestrator, ProductVM } from '@erp/catalog/data-access';
import { MultimediaGroupComponent } from './multimedia-group.component';
import { PRODUCT_KEYS } from '../../translation/keys';

@Component({
  selector: 'erp-multimedia-tab',
  standalone: true,
  imports: [ErpGroupPanelComponent, MultimediaGroupComponent],
  template: `
    <div class="h-full w-full p-2">
      <erp-group-panel [config]="panelConfig">
        <ng-template #erpGroupItem let-product let-index="index" let-measureElement="measureElement">
          <erp-multimedia-group [product]="product" [measureElement]="measureElement" [attr.data-index]="index" />
        </ng-template>
      </erp-group-panel>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultimediaTabComponent {
  private readonly store = inject(ProductStore);
  private readonly productOrchestrator = inject(CatalogProductOrchestrator);

  protected readonly _selectedProducts = computed(() => {
    const selectedItems = this.store.selection()?.selectedItems || [];
    if (selectedItems.length === 0) return [];

    const uuids = selectedItems.map(item => item.uuid);
    const signalMap = this.productOrchestrator.getSignalViewModel();

    return uuids.map(uuid => {
      const vmSignal = signalMap.get(uuid);
      const latestVm = vmSignal ? vmSignal() : null;
      return latestVm || selectedItems.find(x => x.uuid === uuid)!;
    });
  });
  protected readonly _selectionCount = computed(() => this._selectedProducts().length);
  protected readonly _subSelectionCount = computed(() => this.store.selectedMultimedia().size);
  protected readonly _hideMassActions = computed(() => this._selectionCount() <= 1);

  protected readonly toolbarConfig = ErpActionToolbarBuilder.create(b => b
    .setMenuId('multimedia-toolbar')
    .setSelectionCount(this._subSelectionCount)
    .setSelectionLabel('shared.selectionToolbar.selectedFiles')
    .setOnClearSelection(() => this.onClearMediaSelection())
    .addDefaultGroup(g => g
      .setId('mass-actions')
      .setLabel('Masowe zarządzanie')
      .addAction(a => a
        .setId('mass-add')
        .setLabel('Dodaj multimedia masowo')
        .setIcon('@tui.plus')
        .setAppearance('success')
        .setFn(() => this.onAddMass())
      )
      .addAction(a => a
        .setId('mass-delete')
        .setLabel('Usuń wszystkie multimedia')
        .setIcon('@tui.trash')
        .setAppearance('warning')
        .setFn(() => this.onDeleteMass())
      )
    )
    .addDefaultGroup(g => g
      .setId('tools')
      .setLabel('Narzędzia')
      .addAction(a => a
        .setId('scan')
        .setLabel('Skanuj foldery')
        .setIcon('@tui.scan')
        .setFn(() => console.log('Skanuj'))
      )
      .addAction(a => a
        .setId('thumbnails')
        .setLabel('Generuj miniatury')
        .setIcon('@tui.image')
        .setFn(() => console.log('Miniatury'))
      )
    )
    .addSelectionGroup(g => g
      .setId('selection-actions')
      .setLabel('Wybrane operacje')
      .addAction(a => a
        .setId('delete-selected')
        .setLabel('Usuń zaznaczone')
        .setIcon('@tui.trash')
        .setAppearance('warning')
        .setFn(() => this.onDeleteSelectedMedia())
      )
      .addAction(a => a
        .setId('download')
        .setLabel('Pobierz oryginały')
        .setIcon('@tui.download')
        .setFn(() => console.log('Pobierz'))
      )
      .addAction(a => a
        .setId('optimize')
        .setLabel('Optymalizuj wybrane')
        .setIcon('@tui.wand')
        .setFn(() => console.log('Optymalizuj'))
      )
    )
  );

  // Zbiór UUID dla których już wywołaliśmy ładowanie
  private readonly loadedProductUuids = new Set<string>();

  protected readonly panelConfig = ErpGroupPanelBuilder.create<ErpGroupPanelBuilder<ProductVM>>(b => b
    .setToolbar(this.toolbarConfig)
    .setItems(this._selectedProducts)
    .setGetItemKey((_, item) => item.uuid)
    .setEstimateSize(250)
    .setOverscan(2)
    .setOnRangeChange((range) => {
      // Lazy-load: dociągnij produkty z wymuszeniem wczytania multimediów
      const uuidsToLoad = range.visibleKeys.filter((uuid: string) => !this.loadedProductUuids.has(uuid));

      if (uuidsToLoad.length > 0) {
        for (const uuid of uuidsToLoad) {
          this.loadedProductUuids.add(uuid);
        }
        this.productOrchestrator.loadAsync(uuidsToLoad, { includeMultimedia: true });
      }
    })
    .setEmptyState(PRODUCT_KEYS.base.multimedia.panel.emptySelection, '@tui.mouse-pointer-click')
    .setOverflow(MAX_DETAILED_SELECTION, PRODUCT_KEYS.base.multimedia.panel.bulkDescription, '@tui.layers')
  );

  protected onAddMass(): void {
    console.log('Masowe dodawanie multimediów dla', this._selectionCount(), 'produktów');
  }

  protected onDeleteMass(): void {
    console.log('Masowe usuwanie multimediów dla', this._selectionCount(), 'produktów');
  }

  protected onDeleteSelectedMedia(): void {
    console.log('Usuwanie zaznaczonych multimediów:', this.store.selectedMultimedia());
  }

  protected onClearMediaSelection(): void {
    console.log('Czyszczenie zaznaczenia zdjęć');
  }
}
