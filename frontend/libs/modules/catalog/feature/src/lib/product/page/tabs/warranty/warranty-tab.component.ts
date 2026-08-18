import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { WarrantyTabStore } from './warranty-tab.store';
import {
  ErpActionToolbarBuilder,
  ErpActionToolbarComponent,
  ErpActionToolbarContextDirective,
  ErpActionToolbarZoneDirective,
  ErpEmptyStateComponent,
  ErpEmptyStateConfig,
  ErpSelectionScopeBannerBuilder,
  ErpSelectionScopeBannerComponent,
  ErpSelectionState,
  ErpTableBuilder,
  ErpTableComponent,
  ErpTableConfig,
} from '@erp/shared/ui';
import { CatalogProductOrchestrator, CatalogWarrantyOrchestrator, ProductVM, ProductWarrantyVM } from '@erp/catalog/data-access';
import { PRODUCT_KEYS } from '../../../translation/keys';
import { WarrantyInfoCellComponent } from './warranty-info-cell.component';

/**
 * Rozmiar paczki doładowywanych gwarancji — zamiast strzelać do API pojedynczymi UUID-ami
 * przy każdej drobnej zmianie widocznego zakresu, zaokrąglamy zakres w górę/dół do granic
 * paczki i pobieramy ją w całości (jednym żądaniem, zbatchowanym dodatkowo przez DataLoader).
 */
const WARRANTY_CHUNK_SIZE = 30;

/**
 * Panel gwarancji zaznaczonych produktów — konsument zasięgu zaznaczenia (`ErpSelectionScope`),
 * na tych samych zasadach co panel multimediów (patrz `docs/frontend/selection-scope.md`).
 *
 * Panel jest DOWODEM (co obejmie operacja), a nie źródłem prawdy o jej celu: przy zaznaczeniu
 * opisanym filtrem pokazuje próbkę kilku pierwszych produktów i wyłącza wybór pojedynczych
 * gwarancji, a akcje masowe i tak adresują cały zbiór.
 */
@Component({
  selector: 'erp-warranty-tab',
  standalone: true,
  imports: [
    ErpTableComponent,
    ErpActionToolbarComponent,
    ErpActionToolbarZoneDirective,
    ErpActionToolbarContextDirective,
    ErpEmptyStateComponent,
    ErpSelectionScopeBannerComponent,
  ],
  providers: [WarrantyTabStore],
  template: `
    <div class="h-full w-full p-2">
      @if (_scopeKind() === 'none') {
        <erp-empty-state [config]="emptySelectionConfig" />
      } @else if (_resolving()) {
        <erp-empty-state [config]="resolvingConfig" />
      } @else {
        <div class="flex flex-col gap-2 h-full w-full" erpActionToolbarZone [erpActionToolbarContext]="toolbarConfig">
          <erp-action-toolbar [config]="toolbarConfig" />

          <!-- Zdanie o zasięgu: promień rażenia akcji masowych musi być widoczny bez klikania,
               a próbka w tabeli musi być jawnie oznaczona jako próbka, nie jako pełna lista. -->
          <erp-selection-scope-banner [config]="scopeBannerConfig" />

          <div class="flex-1 overflow-hidden" >
            <erp-table
              class="block h-full w-full"
              [config]="tableConfig()"
            />
          </div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WarrantyTabComponent {
  private readonly tabStore = inject(WarrantyTabStore);
  private readonly productOrchestrator = inject(CatalogProductOrchestrator);
  private readonly warrantyOrchestrator = inject(CatalogWarrantyOrchestrator);

  protected readonly _scopeKind = this.tabStore.scopeKind;
  protected readonly _resolving = this.tabStore.resolving;

  /** Produkty renderowane przez panel — komplet zaznaczonych albo próbka z filtra. */
  protected readonly _products = this.tabStore.products;

  /**
   * Wszystkie gwarancje widocznych produktów — jedna wspólna, płaska lista wierszy.
   * `product.warranties` ma jeden wiersz na przypisanie od razu (liczba/kolejność, a więc i
   * wysokość wirtualizera, są poprawne natychmiast) — katalogowe szczegóły każdej gwarancji
   * (nazwa, standardowy okres, opis) doładowują się stopniowo w miarę scrollowania w głąb
   * grupy (patrz `onVisibleRowsChange` niżej) — zamiast pobierać wszystkie gwarancje produktu naraz.
   */
  protected readonly _rows = computed<ProductWarrantyVM[]>(() =>
    this._products().flatMap(product => product.warranties)
  );

  protected readonly emptySelectionConfig: ErpEmptyStateConfig = {
    icon: '@tui.mouse-pointer-click',
    message: PRODUCT_KEYS.base.warranty.panel.emptySelection,
  };

  protected readonly resolvingConfig: ErpEmptyStateConfig = {
    icon: '@tui.loader',
    message: PRODUCT_KEYS.base.selectionScope.resolving,
  };

  protected readonly scopeBannerConfig = ErpSelectionScopeBannerBuilder.create(b => b
    .setScope(this.tabStore.scope)
    .setShownCount(this.tabStore.shownProductCount)
    .setPreviewTitle(PRODUCT_KEYS.base.selectionScope.previewTitle)
    .setPreviewDescription(PRODUCT_KEYS.base.selectionScope.previewDescription)
    .setAllTitle(PRODUCT_KEYS.base.selectionScope.allTitle)
  );

  // Zbiór UUID produktów, dla których już zażądaliśmy bazowego załadowania (dedupikacja).
  private readonly loadedProductUuids = new Set<string>();
  // Zbiór UUID gwarancji (katalogowych), dla których już zażądaliśmy doładowania szczegółów.
  private readonly requestedWarrantyUuids = new Set<string>();

  protected readonly toolbarConfig = ErpActionToolbarBuilder.create((b) =>
    b
      .setMenuId('warranty-tab-toolbar')
      .setSelectionCount(this.tabStore.selectedChildrenCount)
      .setSelectionLabel('shared.selectionToolbar.selectedItems')
      // Zasięg produktów (nie gwarancji!) — na jego podstawie toolbar blokuje akcje wymagające
      // wskazanych pozycji, gdy zaznaczenie jest filtrem.
      .setSelectionScope(this.tabStore.scopeKind)
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
              .setFn(() => this.onAddMass())
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
      // Operacje na WSKAZANYCH gwarancjach — wymagają zaznaczenia rozwiązanego do listy pozycji.
      .addSelectionGroup(g => g
        .setId('selection-actions')
        .setLabel('Wybrane operacje')
        .addAction(a => a
          .setId('delete-selected')
          .setLabel('Usuń zaznaczone')
          .setIcon('@tui.trash')
          .setAppearance('warning')
          .setScopes(['explicit'])
          .setUnavailableHint(PRODUCT_KEYS.base.warranty.panel.scopeWarrantySelectionUnavailable)
          .setFn(() => this.onDeleteSelectedWarranty())
        )
      )
      .setPinnedActionIds(['add', 'refresh'])
      .setEnableContextMenu(true)
  );

  /**
   * Konfiguracja tabeli jest `computed`, bo tryb zaznaczenia zależy od zasięgu: przy zaznaczeniu
   * opisanym filtrem znikają checkboxy gwarancji ORAZ grup (`selectionMode: 'none'`).
   */
  protected readonly tableConfig = computed<ErpTableConfig<ProductWarrantyVM>>(() =>
    ErpTableBuilder.create<ErpTableBuilder<ProductWarrantyVM>>((table) =>
      table
        .setStateKey('product-tab-warranty')
        .setMode('client')
        .setSelectionMode(this.tabStore.canSelectChildren() ? 'multi' : 'none')
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
          .setAccessorFn((r: ProductWarrantyVM) => r.durationMonths)
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
          .setGroups(this._products)
          .setGetGroupKey(p => p.uuid)
          .setGetRowGroupKey((r: ProductWarrantyVM) => r.productUuid)
          .setGetGroupTitle(p => p.name)
          .setGetGroupSubtitle(p => p.codeValue('SKU') ?? '')
          .setGetGroupIcon(() => '@tui.shield-check')
          .setIsGroupLoading(p => (p.warranties?.length ?? 0) === 0 && this.productOrchestrator.isLoading())
          .setDefaultExpanded(true)
          .setLoadChildren(p => this.ensureProductLoaded(p.uuid))
          .setOnVisibleRowsChange((product, visibleRows) => this.loadVisibleWarranties(product, visibleRows))
        )
    )
  );

  /** Ładuje bazowy produkt (raz), aby upewnić się, że `warranties` jest dostępne. */
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
  private loadVisibleWarranties(product: ProductVM, visibleRows: ProductWarrantyVM[]): void {
    if (visibleRows.length === 0) return;

    const allUuids = product.warranties.map(w => w.warrantyUuid);
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

  protected onSelectionChange(state: ErpSelectionState<ProductWarrantyVM>): void {
    this.tabStore.setSelectedChildren(state.selectedItems);
  }

  /**
   * Akcja masowa adresuje ZASIĘG, nie to, co widać w panelu — w trybie filtra cele rozwiąże
   * backend (`targetFilter`), w trybie listy lecą wprost identyfikatory (`targetUuids`).
   */
  protected onAddMass(): void {
    console.log('Masowe dodawanie gwarancji', {
      targets: this.tabStore.batchTargets(),
      count: this.tabStore.scopeCount(),
    });
  }

  protected onDeleteSelectedWarranty(): void {
    console.log('Usuwanie zaznaczonych gwarancji:', this.tabStore.selectedWarrantiesByProduct());
  }

  protected onClearWarrantySelection(): void {
    this.tabStore.clearChildSelection();
  }
}
