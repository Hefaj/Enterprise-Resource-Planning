import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ProductStore } from '../product.store';
import { MAX_DETAILED_SELECTION } from '@erp/catalog/util';
import { ErpActionToolbarBuilder, ErpGroupPanelBuilder, ErpGroupPanelComponent } from '@erp/shared/ui';
import { CatalogProductOrchestrator, ProductVM } from '@erp/catalog/data-access';
import { WarrantyGroupComponent } from './warranty-group.component';
import { PRODUCT_KEYS } from '../../translation/keys';

@Component({
  selector: 'erp-warranty-tab',
  standalone: true,
  imports: [ErpGroupPanelComponent, WarrantyGroupComponent],
  template: `
    <div class="h-full w-full p-2">
      <erp-group-panel [config]="panelConfig">
        <ng-template #erpGroupItem let-product let-index="index" let-measureElement="measureElement">
          <erp-warranty-group [product]="product" [measureElement]="measureElement" [attr.data-index]="index" />
        </ng-template>
      </erp-group-panel>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WarrantyTabComponent {
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
  protected readonly _subSelectionCount = computed(() => this.store.getAllSelectedWarrantiesCount());

  protected readonly toolbarConfig = ErpActionToolbarBuilder.create((b) =>
    b
      .setMenuId('warranty-tab-toolbar')
      .setSelectionCount(this._subSelectionCount)
      .setSelectionLabel('shared.selectionToolbar.selectedItems')
      .setOnClearSelection(() => this.onClearWarrantySelection())
      .addDefaultGroup((g) =>
        g
          .setId('crud')
          .setLabel('Akcje')
          .setIcon('@tui.layers')
          .addAction((a) =>
            a
              .setId('add')
              .setLabel('Dodaj nową gwarancję')
              .setIcon('@tui.plus')
              .setShortcut('Ctrl+N')
              .setAppearance('success')
              .setFn(() => console.log('Dodaj nową gwarancję'))
          )
      )
      .addDefaultGroup((g) =>
        g
          .setId('import-export')
          .setLabel('Eksport i Import')
          .setIcon('@tui.download')
          .addAction((a) =>
            a
              .setId('export-csv')
              .setLabel('Eksportuj do CSV')
              .setIcon('@tui.file-text')
              .setFn(() => console.log('Eksport CSV'))
          )
          .addAction((a) =>
            a
              .setId('export-xml')
              .setLabel('Eksportuj do XML')
              .setIcon('@tui.file-code')
              .setFn(() => console.log('Eksport XML'))
          )
          .addAction((a) =>
            a
              .setId('import')
              .setLabel('Importuj z pliku')
              .setIcon('@tui.upload')
              .setSeparator(true)
              .setFn(() => console.log('Import'))
          )
      )
      .addDefaultGroup((g) =>
        g
          .setId('view-options')
          .setLabel('Opcje widoku')
          .setIcon('@tui.eye')
          .addAction((a) =>
            a
              .setId('refresh')
              .setLabel('Odśwież listę')
              .setIcon('@tui.refresh-cw')
              .setShortcut('F5')
              .setAppearance('info')
              .setFn(() => console.log('Odświeżam'))
          )
          .addAction((a) =>
            a
              .setId('view-archived')
              .setLabel('Pokaż archiwalne')
              .setIcon('@tui.archive')
              .setFn(() => console.log('Pokaż archiwalne'))
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
          .setFn(() => this.onDeleteSelectedWarranty())
        )
      )
      .setPinnedActionIds(['add', 'refresh'])
      .setEnableContextMenu(true)
  );

  // Zbiór UUID dla których już wywołaliśmy ładowanie
  private readonly loadedProductUuids = new Set<string>();

  protected readonly panelConfig = ErpGroupPanelBuilder.create<ErpGroupPanelBuilder<ProductVM>>((b) =>
    b
      .setToolbar(this.toolbarConfig)
      .setItems(this._selectedProducts)
      .setGetItemKey((_, item) => item.uuid)
      .setEstimateSize(220)
      .setOverscan(2)
      .setOnRangeChange((range) => {
        // Lazy-load: dociągnij produkty z wymuszeniem wczytania gwarancji
        const uuidsToLoad = range.visibleKeys.filter((uuid: string) => !this.loadedProductUuids.has(uuid));

        if (uuidsToLoad.length > 0) {
          for (const uuid of uuidsToLoad) {
            this.loadedProductUuids.add(uuid);
          }
          this.productOrchestrator.loadAsync(uuidsToLoad, { includeWarranties: true });
        }
      })
      .setEmptyState(PRODUCT_KEYS.base.warranty.panel.emptySelection, '@tui.mouse-pointer-click')
      .setOverflow(MAX_DETAILED_SELECTION, PRODUCT_KEYS.base.warranty.panel.bulkDescription, '@tui.layers')
  );

  protected onDeleteSelectedWarranty(): void {
    console.log('Usuwanie zaznaczonych gwarancji:', this.store.selectedWarrantiesByProduct());
  }

  protected onClearWarrantySelection(): void {
    this.store.clearWarrantySelection();
  }
}
