import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ProductStore } from '../product.store';
import { ErpActionToolbarBuilder, ErpActionToolbarComponent, ErpActionToolbarContextDirective, ErpActionToolbarZoneDirective, ErpSelectionState, ErpTableBuilder, ErpTableComponent } from '@erp/shared/ui';
import { CatalogProductOrchestrator, ProductVM, ProductWarrantyVM } from '@erp/catalog/data-access';
import { PRODUCT_KEYS } from '../../translation/keys';

/**
 * Wiersz tabeli gwarancji — pojedyncza gwarancja + referencja do produktu, do którego należy
 * (potrzebna, by pogrupować wiersze pod właściwym wierszem-rodzicem produktu).
 */
interface WarrantyRow {
  productUuid: string;
  warranty: ProductWarrantyVM;
}

@Component({
  selector: 'erp-warranty-tab',
  standalone: true,
  imports: [
    ErpTableComponent, 
    ErpActionToolbarComponent,
    ErpActionToolbarZoneDirective,
    ErpActionToolbarContextDirective,
    ],
  template: `
    <div class="h-full w-full p-2">
      <div class="flex flex-col gap-2 h-full w-full" erpActionToolbarZone [erpActionToolbarContext]="toolbarConfig">
        <erp-action-toolbar [config]="toolbarConfig" />
        <div class="flex-1 overflow-hidden" >
          <erp-table
            class="block h-full w-full"
            [config]="tableConfig"
          />
        </div>
      </div>
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

  /** Wszystkie gwarancje wszystkich zaznaczonych produktów — jedna wspólna, płaska lista wierszy. */
  protected readonly _rows = computed<WarrantyRow[]>(() =>
    this._selectedProducts().flatMap(product =>
      (product.warranties ?? []).map(warranty => ({ productUuid: product.uuid, warranty }))
    )
  );

  protected readonly _subSelectionCount = computed(() => this.store.getAllSelectedWarrantiesCount());

  // Zbiór UUID produktów, dla których już wywołaliśmy ładowanie gwarancji
  private readonly loadedProductUuids = new Set<string>();

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

  protected readonly tableConfig = ErpTableBuilder.create<ErpTableBuilder<WarrantyRow>>((table) =>
    table
      .setStateKey('product-tab-warranty')
      .setMode('client')
      .setSelectionMode('multi')
      .setRowIdAccessor(r => `${r.productUuid}:${r.warranty.uuid}`)
      .setItems(this._rows)
      .setItemCount(computed(() => this._rows().length))
      .setEnableVirtualScroll(true)
      .setEstimatedRowHeight(48)
      .setEmptyMessage(PRODUCT_KEYS.base.warranty.panel.emptySelection)
      .setOnSelectionChange(state => this.onSelectionChange(state))
      .addColumn(c => c
        .setId('name')
        .setAccessorFn((r: WarrantyRow) => r.warranty.name)
        .setHeader('Nazwa gwarancji')
        .setSize(220)
      )
      .addColumn(c => c
        .setId('durationMonths')
        .setAccessorFn((r: WarrantyRow) => r.warranty.durationMonths)
        .setHeader('Standardowy okres (mc)')
        .setCellClass('text-right')
        .setSize(150)
      )
      .addColumn(c => c
        .setId('productDurationMonths')
        .setAccessorFn((r: WarrantyRow) => r.warranty.productDurationMonths)
        .setHeader('Okres dla produktu (mc)')
        .setCellClass('text-right')
        .setSize(150)
      )
      .addColumn(c => c
        .setId('description')
        .setAccessorFn((r: WarrantyRow) => r.warranty.description)
        .setHeader('Opis')
        .setSize(400)
      )
      .setGroupedRows<ProductVM>(g => g
        .setGroups(this._selectedProducts)
        .setGetGroupKey(p => p.uuid)
        .setGetRowGroupKey((r: WarrantyRow) => r.productUuid)
        .setGetGroupTitle(p => p.name)
        .setGetGroupSubtitle(p => p.sku)
        .setGetGroupIcon(() => '@tui.shield-check')
        .setIsGroupLoading(p => (p.warranties?.length ?? 0) === 0 && this.productOrchestrator.isLoading())
        .setDefaultExpanded(true)
        .setLoadChildren(p => this.loadWarrantiesFor(p.uuid))
      )
  );

  private loadWarrantiesFor(uuid: string): void {
    if (this.loadedProductUuids.has(uuid)) return;
    this.loadedProductUuids.add(uuid);
    this.productOrchestrator.loadAsync([uuid], { includeWarranties: true });
  }

  protected onSelectionChange(state: ErpSelectionState<WarrantyRow>): void {
    const dict: Record<string, string[]> = {};
    for (const item of state.selectedItems) {
      (dict[item.productUuid] ??= []).push(item.warranty.uuid);
    }
    this.store.setAllWarrantySelections(dict);
  }

  protected onDeleteSelectedWarranty(): void {
    console.log('Usuwanie zaznaczonych gwarancji:', this.store.selectedWarrantiesByProduct());
  }

  protected onClearWarrantySelection(): void {
    this.store.clearWarrantySelection();
  }
}
