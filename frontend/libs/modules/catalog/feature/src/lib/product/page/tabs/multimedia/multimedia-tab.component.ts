import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MultimediaTabStore } from './multimedia-tab.store';
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
import { CatalogMultimediaOrchestrator, CatalogProductOrchestrator, ProductVM } from '@erp/catalog/data-access';
import { PRODUCT_KEYS } from '../../../translation/keys';
import { MultimediaRow } from './multimedia-row.model';
import { MultimediaThumbnailCellComponent } from './multimedia-thumbnail-cell.component';
import { MultimediaInfoCellComponent } from './multimedia-info-cell.component';

/**
 * Rozmiar paczki doładowywanych multimediów — zamiast strzelać do API pojedynczymi UUID-ami
 * przy każdej drobnej zmianie widocznego zakresu, zaokrąglamy zakres w górę/dół do granic
 * paczki i pobieramy ją w całości (jednym żądaniem, zbatchowanym dodatkowo przez DataLoader).
 */
const MULTIMEDIA_CHUNK_SIZE = 30;

/**
 * Panel multimediów zaznaczonych produktów — referencyjny konsument zasięgu zaznaczenia
 * (`ErpSelectionScope`, patrz `product.store.ts` i `product-scope-tab.store.ts`).
 *
 * Zasada, którą realizuje: panel jest DOWODEM (co obejmie operacja), a nie źródłem prawdy
 * o jej celu. Celem jest zasięg — lista uuidów albo filtr. Dlatego przy zaznaczeniu opisanym
 * filtrem panel nie próbuje wczytać multimediów tysięcy produktów: pokazuje próbkę kilku
 * pierwszych i wyłącza wybór pojedynczych plików, a akcje masowe i tak lecą na cały zbiór.
 *
 * Całą mechanikę zasięgu (próbka, blokada wyboru, cele akcji) dziedziczy po
 * `ProductScopeTabStore` — ten sam zestaw dostają pozostałe zakładki strony produktów.
 */
@Component({
  selector: 'erp-multimedia-tab',
  standalone: true,
  imports: [
    ErpTableComponent,
    ErpActionToolbarComponent,
    ErpActionToolbarZoneDirective,
    ErpActionToolbarContextDirective,
    ErpEmptyStateComponent,
    ErpSelectionScopeBannerComponent,
  ],
  providers: [MultimediaTabStore],
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

          <div class="flex-1 overflow-hidden">
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
export class MultimediaTabComponent {
  private readonly tabStore = inject(MultimediaTabStore);
  private readonly productOrchestrator = inject(CatalogProductOrchestrator);
  private readonly multimediaOrchestrator = inject(CatalogMultimediaOrchestrator);

  protected readonly _scopeKind = this.tabStore.scopeKind;
  protected readonly _resolving = this.tabStore.resolving;

  /** Produkty renderowane przez panel — komplet zaznaczonych albo próbka z filtra. */
  protected readonly _products = this.tabStore.products;

  /**
   * Wszystkie multimedia widocznych produktów — jedna wspólna, płaska lista wierszy.
   * Budowana z `multimediaUuids` (znane od razu — to zwykłe pole produktu, nie wymaga osobnego
   * ładowania), NIE z rozwiązanego `product.multimedia` — dzięki temu liczba i kolejność wierszy
   * (a więc i wysokość wirtualizera) są poprawne natychmiast, a szczegóły każdego wiersza
   * (miniaturka, nazwa, rozmiar) doładowują się stopniowo w miarę scrollowania w głąb grupy
   * (patrz `onVisibleRowsChange` niżej) — zamiast pobierać wszystkie multimedia produktu naraz.
   */
  protected readonly _rows = computed<MultimediaRow[]>(() =>
    this._products().flatMap(product =>
      (product.multimediaUuids ?? []).map(uuid => ({ productUuid: product.uuid, uuid }))
    )
  );

  protected readonly emptySelectionConfig: ErpEmptyStateConfig = {
    icon: '@tui.mouse-pointer-click',
    message: PRODUCT_KEYS.base.multimedia.panel.emptySelection,
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
  // Zbiór UUID multimediów, dla których już zażądaliśmy doładowania szczegółów (dedupikacja).
  private readonly requestedMultimediaUuids = new Set<string>();

  protected readonly toolbarConfig = ErpActionToolbarBuilder.create(b => b
    .setMenuId('multimedia-toolbar')
    .setSelectionCount(this.tabStore.selectedChildrenCount)
    .setSelectionLabel('shared.selectionToolbar.selectedFiles')
    // Zasięg produktów (nie plików!) — na jego podstawie toolbar blokuje akcje wymagające
    // wskazanych pozycji, gdy zaznaczenie jest filtrem.
    .setSelectionScope(this.tabStore.scopeKind)
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
    // Operacje na WSKAZANYCH plikach — wymagają zaznaczenia rozwiązanego do listy pozycji.
    // Deklaracja jest tu po to, żeby niezmiennik był zapisany w konfiguracji akcji, a nie
    // wynikał ubocznie z tego, że w trybie filtra i tak nie da się nic zaznaczyć.
    .addSelectionGroup(g => g
      .setId('selection-actions')
      .setLabel('Wybrane operacje')
      .addAction(a => a
        .setId('delete-selected')
        .setLabel('Usuń zaznaczone')
        .setIcon('@tui.trash')
        .setAppearance('warning')
        .setScopes(['explicit'])
        .setUnavailableHint(PRODUCT_KEYS.base.multimedia.panel.scopeFileSelectionUnavailable)
        .setFn(() => this.onDeleteSelectedMedia())
      )
      .addAction(a => a
        .setId('download')
        .setLabel('Pobierz oryginały')
        .setIcon('@tui.download')
        .setScopes(['explicit'])
        .setUnavailableHint(PRODUCT_KEYS.base.multimedia.panel.scopeFileSelectionUnavailable)
        .setFn(() => console.log('Pobierz'))
      )
      .addAction(a => a
        .setId('optimize')
        .setLabel('Optymalizuj wybrane')
        .setIcon('@tui.wand')
        .setScopes(['explicit'])
        .setUnavailableHint(PRODUCT_KEYS.base.multimedia.panel.scopeFileSelectionUnavailable)
        .setFn(() => console.log('Optymalizuj'))
      )
    )
  );

  /**
   * Konfiguracja tabeli jest `computed`, bo tryb zaznaczenia zależy od zasięgu: przy zaznaczeniu
   * opisanym filtrem znikają checkboxy plików ORAZ grup (`selectionMode: 'none'`).
   */
  protected readonly tableConfig = computed<ErpTableConfig<MultimediaRow>>(() =>
    ErpTableBuilder.create<ErpTableBuilder<MultimediaRow>>((table) =>
      table
        .setStateKey('product-tab-multimedia')
        .setMode('client')
        .setSelectionMode(this.tabStore.canSelectChildren() ? 'multi' : 'none')
        .setRowIdAccessor(r => `${r.productUuid}:${r.uuid}`)
        .setItems(this._rows)
        .setItemCount(computed(() => this._rows().length))
        .setEnableVirtualScroll(true)
        .setEstimatedRowHeight(56)
        .setEmptyMessage(PRODUCT_KEYS.base.multimedia.panel.emptySelection)
        .setOnSelectionChange(state => this.onSelectionChange(state))
        .addColumn(c => c
          .setId('thumbnail')
          .setHeader('Miniatura')
          .setCell(MultimediaThumbnailCellComponent)
          .setEnableSorting(false)
          .setSize(100)
        )
        .addColumn(c => c
          .setId('fileName')
          .setHeader('Nazwa pliku')
          .setCell(MultimediaInfoCellComponent, { field: 'fileName' })
          .setSize(320)
        )
        .addColumn(c => c
          .setId('mediaType')
          .setHeader('Typ')
          .setCell(MultimediaInfoCellComponent, { field: 'mediaType' })
          .setSize(140)
        )
        .addColumn(c => c
          .setId('fileSize')
          .setHeader('Rozmiar')
          .setCell(MultimediaInfoCellComponent, { field: 'fileSize' })
          .setCellClass('text-right')
          .setSize(120)
        )
        .setGroupedRows<ProductVM>(g => g
          .setGroups(this._products)
          .setGetGroupKey(p => p.uuid)
          .setGetRowGroupKey((r: MultimediaRow) => r.productUuid)
          .setGetGroupTitle(p => p.name)
          .setGetGroupSubtitle(p => p.codeValue('SKU') ?? '')
          .setGetGroupIcon(() => '@tui.image')
          .setIsGroupLoading(p => (p.multimediaUuids?.length ?? 0) === 0 && this.productOrchestrator.isLoading())
          .setDefaultExpanded(true)
          .setLoadChildren(p => this.ensureProductLoaded(p.uuid))
          .setOnVisibleRowsChange((product, visibleRows) => this.loadVisibleMultimedia(product, visibleRows))
        )
    )
  );

  /** Ładuje bazowy produkt (raz), aby upewnić się, że `multimediaUuids` jest dostępne. */
  private ensureProductLoaded(uuid: string): void {
    if (this.loadedProductUuids.has(uuid)) return;
    this.loadedProductUuids.add(uuid);
    this.productOrchestrator.loadAsync([uuid]);
  }

  /**
   * Doładowuje szczegóły multimediów dla wierszy widocznych w wirtualizerze — nie pojedynczo,
   * tylko całą paczką (`MULTIMEDIA_CHUNK_SIZE`), do której należy widoczny zakres. Dzięki temu
   * przewijanie o kilka wierszy nie generuje osobnego żądania do API za każdym razem — kolejne
   * żądanie pojawia się dopiero po przekroczeniu granicy już pobranej paczki.
   */
  private loadVisibleMultimedia(product: ProductVM, visibleRows: MultimediaRow[]): void {
    if (visibleRows.length === 0) return;

    const allUuids = product.multimediaUuids ?? [];
    let minIndex = Infinity;
    let maxIndex = -Infinity;
    for (const row of visibleRows) {
      const idx = allUuids.indexOf(row.uuid);
      if (idx === -1) continue;
      if (idx < minIndex) minIndex = idx;
      if (idx > maxIndex) maxIndex = idx;
    }
    if (minIndex === Infinity) return;

    const chunkStart = Math.floor(minIndex / MULTIMEDIA_CHUNK_SIZE) * MULTIMEDIA_CHUNK_SIZE;
    const chunkEnd = Math.min(allUuids.length, Math.ceil((maxIndex + 1) / MULTIMEDIA_CHUNK_SIZE) * MULTIMEDIA_CHUNK_SIZE);

    const uuidsToLoad: string[] = [];
    for (let i = chunkStart; i < chunkEnd; i++) {
      const uuid = allUuids[i];
      if (!this.requestedMultimediaUuids.has(uuid)) {
        this.requestedMultimediaUuids.add(uuid);
        uuidsToLoad.push(uuid);
      }
    }
    if (uuidsToLoad.length === 0) return;

    this.multimediaOrchestrator.loadAsync(uuidsToLoad);
  }

  protected onSelectionChange(state: ErpSelectionState<MultimediaRow>): void {
    this.tabStore.setSelectedChildren(state.selectedItems);
  }

  /**
   * Akcje masowe adresują ZASIĘG, nie to, co widać w panelu — w trybie filtra cele rozwiąże
   * backend (`targetFilter`), w trybie listy lecą wprost identyfikatory (`targetUuids`).
   * Składanie celów idzie przez `ProductScopeTabStore.batchTargets()`, żeby żaden komponent
   * nie decydował o tym po swojemu.
   */
  protected onAddMass(): void {
    console.log('Masowe dodawanie multimediów', {
      targets: this.tabStore.batchTargets(),
      count: this.tabStore.scopeCount(),
    });
  }

  protected onDeleteMass(): void {
    console.log('Masowe usuwanie multimediów', {
      targets: this.tabStore.batchTargets(),
      count: this.tabStore.scopeCount(),
    });
  }

  protected onDeleteSelectedMedia(): void {
    console.log('Usuwanie zaznaczonych multimediów:', this.tabStore.selectedMultimedia());
  }

  protected onClearMediaSelection(): void {
    this.tabStore.clearChildSelection();
  }
}
