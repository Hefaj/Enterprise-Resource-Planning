import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ProductStore } from '../product.store';
import { ErpActionToolbarBuilder, ErpActionToolbarComponent, ErpActionToolbarContextDirective, ErpActionToolbarZoneDirective, ErpEmptyStateComponent, ErpEmptyStateConfig, ErpSelectionState, ErpTableBuilder, ErpTableComponent } from '@erp/shared/ui';
import { CatalogProductOrchestrator, CatalogWarrantyOrchestrator, ProductVM } from '@erp/catalog/data-access';
import { PRODUCT_KEYS } from '../../translation/keys';
import { WarrantyRow } from './warranty-row.model';
import { WarrantyInfoCellComponent } from './warranty-info-cell.component';

/**
 * Rozmiar paczki doładowywanych gwarancji — zamiast strzelać do API pojedynczymi UUID-ami
 * przy każdej drobnej zmianie widocznego zakresu, zaokrąglamy zakres w górę/dół do granic
 * paczki i pobieramy ją w całości (jednym żądaniem, zbatchowanym dodatkowo przez DataLoader).
 */
const WARRANTY_CHUNK_SIZE = 30;

@Component({
  selector: 'erp-warranty-tab',
  standalone: true,
  imports: [
    ErpTableComponent,
    ErpActionToolbarComponent,
    ErpActionToolbarZoneDirective,
    ErpActionToolbarContextDirective,
    ErpEmptyStateComponent,
    ],
  template: `
    <div class="h-full w-full p-2">
      @if (_selectedProducts().length === 0) {
        <erp-empty-state [config]="emptySelectionConfig" />
      } @else {
        <div class="flex flex-col gap-2 h-full w-full" erpActionToolbarZone [erpActionToolbarContext]="toolbarConfig">
          <erp-action-toolbar [config]="toolbarConfig" />
          <div class="flex-1 overflow-hidden" >
            <erp-table
              class="block h-full w-full"
              [config]="tableConfig"
            />
          </div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WarrantyTabComponent {
  private readonly store = inject(ProductStore);
  private readonly productOrchestrator = inject(CatalogProductOrchestrator);
  private readonly warrantyOrchestrator = inject(CatalogWarrantyOrchestrator);

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

  /**
   * Wszystkie gwarancje wszystkich zaznaczonych produktów — jedna wspólna, płaska lista wierszy.
   * Budowana z `warrantyAssignments` (znane od razu — zwykłe pole produktu, nie wymaga osobnego
   * ładowania), NIE z rozwiązanego `product.warranties` — dzięki temu liczba i kolejność wierszy
   * (a więc i wysokość wirtualizera) są poprawne natychmiast, a katalogowe szczegóły każdej
   * gwarancji (nazwa, standardowy okres, opis) doładowują się stopniowo w miarę scrollowania
   * w głąb grupy (patrz `onVisibleRowsChange` niżej) — zamiast pobierać wszystkie gwarancje
   * produktu naraz.
   */
  protected readonly _rows = computed<WarrantyRow[]>(() =>
    this._selectedProducts().flatMap(product =>
      (product.warrantyAssignments ?? []).map(w => ({
        productUuid: product.uuid,
        warrantyUuid: w.warrantyUuid,
        productDurationMonths: w.durationMonths,
      }))
    )
  );

  protected readonly _subSelectionCount = computed(() => this.store.getAllSelectedWarrantiesCount());

  protected readonly emptySelectionConfig: ErpEmptyStateConfig = {
    icon: '@tui.mouse-pointer-click',
    message: PRODUCT_KEYS.base.warranty.panel.emptySelection,
  };

  // Zbiór UUID produktów, dla których już zażądaliśmy bazowego załadowania (dedupikacja).
  private readonly loadedProductUuids = new Set<string>();
  // Zbiór UUID gwarancji (katalogowych), dla których już zażądaliśmy doładowania szczegółów.
  private readonly requestedWarrantyUuids = new Set<string>();

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
      .setRowIdAccessor(r => `${r.productUuid}:${r.warrantyUuid}`)
      .setItems(this._rows)
      .setItemCount(computed(() => this._rows().length))
      .setEnableVirtualScroll(true)
      .setEstimatedRowHeight(48)
      .setEmptyMessage(PRODUCT_KEYS.base.warranty.panel.emptySelection)
      .setOnSelectionChange(state => this.onSelectionChange(state))
      .addColumn(c => c
        .setId('name')
        .setHeader('Nazwa gwarancji')
        .setCell(WarrantyInfoCellComponent, { field: 'name' })
        .setSize(220)
      )
      .addColumn(c => c
        .setId('durationMonths')
        .setHeader('Standardowy okres (mc)')
        .setCell(WarrantyInfoCellComponent, { field: 'durationMonths' })
        .setCellClass('text-right')
        .setSize(150)
      )
      .addColumn(c => c
        .setId('productDurationMonths')
        .setAccessorFn((r: WarrantyRow) => r.productDurationMonths)
        .setHeader('Okres dla produktu (mc)')
        .setCellClass('text-right')
        .setSize(150)
      )
      .addColumn(c => c
        .setId('description')
        .setHeader('Opis')
        .setCell(WarrantyInfoCellComponent, { field: 'description' })
        .setSize(400)
      )
      .setGroupedRows<ProductVM>(g => g
        .setGroups(this._selectedProducts)
        .setGetGroupKey(p => p.uuid)
        .setGetRowGroupKey((r: WarrantyRow) => r.productUuid)
        .setGetGroupTitle(p => p.name)
        .setGetGroupSubtitle(p => p.sku)
        .setGetGroupIcon(() => '@tui.shield-check')
        .setIsGroupLoading(p => (p.warrantyAssignments?.length ?? 0) === 0 && this.productOrchestrator.isLoading())
        .setDefaultExpanded(true)
        .setLoadChildren(p => this.ensureProductLoaded(p.uuid))
        .setOnVisibleRowsChange((product, visibleRows) => this.loadVisibleWarranties(product, visibleRows))
      )
  );

  /** Ładuje bazowy produkt (raz), aby upewnić się, że `warrantyAssignments` jest dostępne. */
  private ensureProductLoaded(uuid: string): void {
    if (this.loadedProductUuids.has(uuid)) return;
    this.loadedProductUuids.add(uuid);
    this.productOrchestrator.loadAsync([uuid]);
  }

  /**
   * Doładowuje katalogowe szczegóły gwarancji dla wierszy widocznych w wirtualizerze — nie
   * pojedynczo, tylko całą paczką (`WARRANTY_CHUNK_SIZE`), do której należy widoczny zakres.
   * Dzięki temu przewijanie o kilka wierszy nie generuje osobnego żądania do API za każdym
   * razem — kolejne żądanie pojawia się dopiero po przekroczeniu granicy już pobranej paczki.
   */
  private loadVisibleWarranties(product: ProductVM, visibleRows: WarrantyRow[]): void {
    if (visibleRows.length === 0) return;

    const allUuids = (product.warrantyAssignments ?? []).map(w => w.warrantyUuid);
    let minIndex = Infinity;
    let maxIndex = -Infinity;
    for (const row of visibleRows) {
      const idx = allUuids.indexOf(row.warrantyUuid);
      if (idx === -1) continue;
      if (idx < minIndex) minIndex = idx;
      if (idx > maxIndex) maxIndex = idx;
    }
    if (minIndex === Infinity) return;

    const chunkStart = Math.floor(minIndex / WARRANTY_CHUNK_SIZE) * WARRANTY_CHUNK_SIZE;
    const chunkEnd = Math.min(allUuids.length, Math.ceil((maxIndex + 1) / WARRANTY_CHUNK_SIZE) * WARRANTY_CHUNK_SIZE);

    const uuidsToLoad: string[] = [];
    for (let i = chunkStart; i < chunkEnd; i++) {
      const uuid = allUuids[i];
      if (!this.requestedWarrantyUuids.has(uuid)) {
        this.requestedWarrantyUuids.add(uuid);
        uuidsToLoad.push(uuid);
      }
    }
    if (uuidsToLoad.length === 0) return;

    this.warrantyOrchestrator.loadAsync(uuidsToLoad);
  }

  protected onSelectionChange(state: ErpSelectionState<WarrantyRow>): void {
    const dict: Record<string, string[]> = {};
    for (const item of state.selectedItems) {
      (dict[item.productUuid] ??= []).push(item.warrantyUuid);
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
