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
  ErpBatchMetadata,
  ErpModalService,
  ErpConfirmDialogBuilder,
  ErpConfirmDialogService,
  ErpMediaPreviewBuilder,
  ErpMediaPreviewItem,
  ErpMediaPreviewService,
  ErpToastService,
} from '@erp/shared/ui';
import {
  BatchCommandOfProductAddMultimediaCommandAndSearchProductRequest,
  CatalogMultimediaContentService,
  CatalogMultimediaDownloadService,
  CatalogMultimediaOrchestrator,
  CatalogProductOrchestrator,
  MultimediaExecGenerateDerivativesCommand,
  MultimediaVM,
  ProductRemoveMultimediaCommand,
  ProductVM,
} from '@erp/catalog/data-access';
import { PRODUCT_ADD_MULTIMEDIA_MODAL_ID } from '@erp/catalog/util';
import { PRODUCT_KEYS } from '../../../../translation/keys';
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
 * Etykieta wywołującego dla zadań zlecanych z tej zakładki. Wraca w `JobDto.queueId` i grupuje
 * powiadomienia („3 zadania z panelu multimediów") — modal ma tu własny identyfikator, bo tam
 * jest do czego wrócić przy ponowieniu; te akcje idą wprost z toolbara.
 */
const MULTIMEDIA_TAB_QUEUE_ID = 'catalog-product-multimedia-tab';

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
  private readonly modalService = inject(ErpModalService);
  private readonly confirmDialog = inject(ErpConfirmDialogService);
  private readonly contentService = inject(CatalogMultimediaContentService);
  private readonly downloadService = inject(CatalogMultimediaDownloadService);
  private readonly mediaPreview = inject(ErpMediaPreviewService);
  private readonly toast = inject(ErpToastService);

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
      .setLabel(PRODUCT_KEYS.base.multimedia.toolbar.massGroup)
      .addAction(a => a
        .setId('mass-add')
        .setLabel(PRODUCT_KEYS.base.multimedia.panel.bulkAdd)
        .setIcon('@tui.plus')
        .setAppearance('success')
        .setFn(() => this.onAddMass())
      )
      .addAction(a => a
        .setId('mass-delete')
        .setLabel(PRODUCT_KEYS.base.multimedia.panel.bulkDelete)
        .setIcon('@tui.trash')
        .setAppearance('warning')
        .setFn(() => this.onDeleteMass())
      )
      // Bramkowane zasięgiem, mimo że leży w grupie masowej: „wszystkie" musi znaczyć
      // wszystkie, a przy zaznaczeniu opisanym filtrem panel zna wyłącznie próbkę produktów.
      // Pobranie próbki pod etykietą „pobierz wszystkie" byłoby cichym okłamaniem użytkownika
      // co do tego, co właśnie dostał.
      .addAction(a => a
        .setId('download-all')
        .setLabel(PRODUCT_KEYS.base.multimedia.toolbar.downloadAll)
        .setIcon('@tui.hard-drive-download')
        .setScopes(['explicit'])
        .setUnavailableHint(PRODUCT_KEYS.base.multimedia.panel.scopeDownloadAllUnavailable)
        .setFn(() => this.onDownloadAll())
      )
    )
    .addDefaultGroup(g => g
      .setId('tools')
      .setLabel(PRODUCT_KEYS.base.multimedia.toolbar.toolsGroup)
      .addAction(a => a
        .setId('scan')
        .setLabel(PRODUCT_KEYS.base.multimedia.toolbar.scan)
        .setIcon('@tui.scan')
        .setFn(() => console.log('Skanuj'))
      )
    )
    // Operacje na WSKAZANYCH plikach — wymagają zaznaczenia rozwiązanego do listy pozycji.
    // Deklaracja jest tu po to, żeby niezmiennik był zapisany w konfiguracji akcji, a nie
    // wynikał ubocznie z tego, że w trybie filtra i tak nie da się nic zaznaczyć.
    .addSelectionGroup(g => g
      .setId('selection-actions')
      .setLabel(PRODUCT_KEYS.base.multimedia.toolbar.selectionGroup)
      .addAction(a => a
        .setId('delete-selected')
        .setLabel(PRODUCT_KEYS.base.multimedia.toolbar.deleteSelected)
        .setIcon('@tui.trash')
        .setAppearance('warning')
        .setScopes(['explicit'])
        .setUnavailableHint(PRODUCT_KEYS.base.multimedia.panel.scopeFileSelectionUnavailable)
        .setFn(() => this.onDeleteSelectedMedia())
      )
      // Grupa zaznaczenia, nie „Narzędzia": akcja działa na WSKAZANYCH plikach, a toolbar
      // w trybie zaznaczenia pokazuje wyłącznie grupy zaznaczeniowe (`selectionCount > 0`).
      // W grupie domyślnej byłaby widoczna dokładnie wtedy, kiedy nie ma czego generować.
      .addAction(a => a
        .setId('thumbnails')
        .setLabel(PRODUCT_KEYS.base.multimedia.toolbar.thumbnails)
        .setIcon('@tui.image')
        .setScopes(['explicit'])
        .setUnavailableHint(PRODUCT_KEYS.base.multimedia.panel.scopeFileSelectionUnavailable)
        .setFn(() => this.onGenerateDerivatives())
      )
      .addAction(a => a
        .setId('download')
        .setLabel(PRODUCT_KEYS.base.multimedia.toolbar.download)
        .setIcon('@tui.download')
        .setScopes(['explicit'])
        .setUnavailableHint(PRODUCT_KEYS.base.multimedia.panel.scopeFileSelectionUnavailable)
        .setFn(() => this.onDownloadSelected())
      )
      .addAction(a => a
        .setId('optimize')
        .setLabel(PRODUCT_KEYS.base.multimedia.toolbar.optimize)
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
        .setOnRowDoubleClick(row => this.onPreview(row))
        .addColumn(c => c
          .setId('thumbnail')
          .setHeader(PRODUCT_KEYS.base.multimedia.columns.thumbnail)
          // Kliknięcie w samą miniaturkę też otwiera podgląd — to jest miejsce, w które
          // użytkownik celuje najpierw, i wymaganie od niego dwukliku akurat tam byłoby
          // uporem. Reszta wiersza zostaje przy dwukliku, żeby pojedyncze kliknięcie
          // nadal służyło zaznaczaniu.
          .setCell(MultimediaThumbnailCellComponent, { onPreview: (row: MultimediaRow) => this.onPreview(row) })
          .setEnableSorting(false)
          .setSize(100)
          .setGrow(0)
        )
        .addColumn(c => c
          .setId('fileName')
          .setHeader(PRODUCT_KEYS.base.multimedia.columns.fileName)
          .setCell(MultimediaInfoCellComponent, { field: 'fileName' })
          .setSize(320)
        )
        .addColumn(c => c
          .setId('mediaType')
          .setHeader(PRODUCT_KEYS.base.multimedia.columns.mediaType)
          .setCell(MultimediaInfoCellComponent, { field: 'mediaType' })
          .setSize(140)
          .setGrow(0)
        )
        .addColumn(c => c
          .setId('fileSize')
          .setHeader(PRODUCT_KEYS.base.multimedia.columns.fileSize)
          .setCell(MultimediaInfoCellComponent, { field: 'fileSize' })
          .setCellClass('text-right')
          .setSize(120)
          .setGrow(0)
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
    // Cele to ZASIĘG zaznaczenia produktów, nie wiersze widoczne w panelu: przy zaznaczeniu
    // opisanym filtrem panel pokazuje próbkę kilku produktów, a operacja obejmie wszystkie
    // pasujące. Składa je `batchTargets()`, żeby żaden komponent nie decydował o tym po swojemu.
    this.modalService.open<BatchCommandOfProductAddMultimediaCommandAndSearchProductRequest, ErpBatchMetadata>(
      PRODUCT_ADD_MULTIMEDIA_MODAL_ID,
      this.tabStore.batchTargets(),
      { targetCount: this.tabStore.scopeCount() },
    );
  }

  /**
   * „Zdejmij wszystkie multimedia" z produktów objętych zasięgiem.
   *
   * <b>Idzie podmianą galerii na pustą, a nie listą plików do odpięcia</b> — i to jest tu jedyna
   * nieoczywista decyzja. Przy zaznaczeniu opisanym filtrem panel widzi próbkę kilku produktów,
   * więc listy plików pozostałych celów po prostu nie zna; zebranie jej wymagałoby pobrania
   * galerii wszystkich pasujących produktów tylko po to, żeby odesłać ją z powrotem. Komenda
   * `SetMultimedia` z pustą listą adresuje stan docelowy, jest idempotentna i nie zależy od tego,
   * co front zdążył wczytać (`docs/backend/endpoint-naming.md` §2).
   */
  protected onDeleteMass(): void {
    const targets = this.tabStore.batchTargets();
    const count = this.tabStore.scopeCount();

    void this.confirmDialog
      .confirmThenAsync(
        ErpConfirmDialogBuilder.create(b =>
          b.setKeys(PRODUCT_KEYS.base.multimedia.confirm.clearAll, { count }).setDestructive(),
        ),
        () =>
          this.productOrchestrator.setMultimediaMultipleAsync(
            { ...targets, templateCommand: { multimediaUuids: [] } },
            MULTIMEDIA_TAB_QUEUE_ID,
          ),
      )
      .catch((err: unknown) => console.error('[MultimediaTabComponent] Nie udało się wyczyścić galerii.', err));
  }

  /**
   * Odpięcie WSKAZANYCH plików od produktów, przy których wiszą.
   *
   * Wiersz panelu to para (produkt, plik), więc jeden zaznaczony plik widoczny pod dwoma
   * produktami daje dwa wiersze i ma zniknąć spod obu. Dlatego cele składamy jawną listą komend
   * — po jednej na produkt — zamiast szablonu: każdy produkt zdejmuje własny podzbiór plików.
   *
   * Akcja jest bramkowana zasięgiem `explicit` (patrz `setScopes` w toolbarze), więc lista
   * zaznaczonych wierszy jest tu pełna, a nie próbką.
   */
  protected onDeleteSelectedMedia(): void {
    const byProduct = new Map<string, string[]>();
    for (const row of this.tabStore.selectedChildren()) {
      const uuids = byProduct.get(row.productUuid) ?? [];
      uuids.push(row.uuid);
      byProduct.set(row.productUuid, uuids);
    }

    if (byProduct.size === 0) return;

    const commands: ProductRemoveMultimediaCommand[] = [...byProduct].map(([uuid, multimediaUuids]) => ({
      uuid,
      multimediaUuids,
    }));

    void this.confirmDialog
      .confirmThenAsync(
        ErpConfirmDialogBuilder.create(b =>
          b
            .setKeys(PRODUCT_KEYS.base.multimedia.confirm.removeSelected, {
              count: this.tabStore.selectedMultimedia().size,
            })
            .setDestructive(),
        ),
        async () => {
          await this.productOrchestrator.removeMultimediaMultipleAsync({ commands }, MULTIMEDIA_TAB_QUEUE_ID);
          this.tabStore.clearChildSelection();
        },
      )
      .catch((err: unknown) => console.error('[MultimediaTabComponent] Nie udało się odpiąć plików.', err));
  }

  /**
   * Ponowne zlecenie miniaturek dla wskazanych plików.
   *
   * <b>Odsiewamy tu zasoby, które wariantów nie potrzebują</b> — mają je już albo nie są
   * obrazami z naszego magazynu. Backend odrzuciłby je i tak, ale osobnym `job_item` z błędem:
   * użytkownik zobaczyłby w raporcie zadania kilkanaście „porażek", z których żadna nie jest
   * jego problemem. Szczegóły zaznaczonych plików bywają jeszcze niewczytane (doładowują się
   * ze scrollem), więc najpierw je zamawiamy — inaczej filtr odsiałby wszystko poza tym,
   * do czego użytkownik akurat doscrollował.
   */
  protected async onGenerateDerivatives(): Promise<void> {
    const uuids = [...this.tabStore.selectedMultimedia()];

    if (uuids.length === 0) {
      this.toast.show({
        message: PRODUCT_KEYS.base.multimedia.toast.nothingSelected,
        appearance: 'info',
      });
      return;
    }

    this.ensureMultimediaLoaded(uuids);
    await this.multimediaOrchestrator.loadAsync(uuids);

    const targets = uuids.filter(uuid => {
      const vm = this.multimediaOrchestrator.getOne(uuid)();

      return !!vm && vm.mediaType === 'image' && !vm.originalUrl && !vm.hasDerivatives;
    });

    if (targets.length === 0) {
      this.toast.show({
        message: PRODUCT_KEYS.base.multimedia.toast.derivativesNothingToDo,
        appearance: 'info',
      });
      return;
    }

    const commands: MultimediaExecGenerateDerivativesCommand[] = targets.map(uuid => ({ uuid }));

    await this.multimediaOrchestrator.generateDerivativesMultipleAsync({ commands }, MULTIMEDIA_TAB_QUEUE_ID);

    // Zadanie kończy się na przyjęciu zleceń, nie na gotowych plikach — a miniaturka wskoczy
    // do tabeli sama, zdarzeniem `AggregateChanged`. Bez tego zdania użytkownik patrzy na
    // niezmienioną tabelę i uznaje, że akcja nic nie zrobiła.
    this.toast.show({
      message: { key: PRODUCT_KEYS.base.multimedia.toast.derivativesRequested, params: { count: targets.length } },
      appearance: 'info',
    });
  }

  protected onClearMediaSelection(): void {
    this.tabStore.clearChildSelection();
  }

  /**
   * Otwiera podgląd pliku, po którym użytkownik kliknął dwukrotnie.
   *
   * <b>Galeria obejmuje pliki JEDNEGO produktu</b>, a nie całą zawartość panelu. Panel jest
   * płaską listą par (produkt, plik) z kilku produktów naraz — przewijanie strzałkami przez
   * granicę produktu wyglądałoby jak zgubienie kontekstu, a przy okazji kazałoby doładować
   * szczegóły wszystkich wierszy panelu tylko dlatego, że ktoś otworzył jeden obrazek.
   */
  protected onPreview(row: MultimediaRow): void {
    const groupRows = this._rows().filter(r => r.productUuid === row.productUuid);

    if (groupRows.length === 0) {
      return;
    }

    // Sąsiadów w galerii trzeba doładować jawnie: `onVisibleRowsChange` zamawia szczegóły
    // tylko dla wierszy widocznych w wirtualizerze, a strzałka w podglądzie sięga dalej niż
    // to, co akurat mieści się na ekranie panelu.
    this.ensureMultimediaLoaded(groupRows.map(r => r.uuid));

    this.mediaPreview
      .open(
        ErpMediaPreviewBuilder.create(b => b
          .setItems(computed(() => groupRows.map(r => this.toPreviewItem(r))))
          .setStartId(previewItemId(row))
          .setOnDownload(item => this.downloadByRowId(item.id)),
        ),
      )
      .subscribe();
  }

  /**
   * Zamienia wiersz panelu na pozycję podglądu.
   *
   * Adres jest `computed`, a nie gotowym stringiem, i to jest tu rzecz nieoczywista: `computed`
   * liczy się **leniwie**, przy pierwszym odczycie. Podgląd czyta wyłącznie adres oglądanej
   * pozycji, więc otwarcie galerii dwustu zdjęć nie zamawia dwustu plików — pobiera się ten
   * jeden, na który użytkownik patrzy, i kolejne dopiero pod strzałką.
   */
  private toPreviewItem(row: MultimediaRow): ErpMediaPreviewItem {
    const vm = this.multimediaOrchestrator.getOne(row.uuid)();

    return {
      id: previewItemId(row),
      fileName: vm?.fileName ?? '',
      caption: vm ? formatPreviewCaption(vm) : undefined,
      renderable: vm ? vm.mediaType === 'image' : true,
      icon: '@tui.file',
      url: computed(() => {
        const current = this.multimediaOrchestrator.getOne(row.uuid)();

        if (!current) {
          return undefined;
        }

        if (current.originalUrl) {
          return current.originalUrl;
        }

        // Wariant `preview` (1024 px) zamiast oryginału — okno ma najwyżej kilkaset pikselów
        // wysokości, więc zdjęcie 4K nie wniosłoby tu nic poza sześcioma megabajtami transferu.
        // Bez wariantów schodzimy na oryginał: to świadomy koszt jednego pliku, na żądanie,
        // zamiast pokazania użytkownikowi pustego okna.
        return current.hasDerivatives
          ? this.contentService.variantUrl(current.uuid, 'preview')()
          : this.contentService.contentUrl(current.uuid)();
      }),
    };
  }

  /** Pobranie oryginału z poziomu okna podglądu — po identyfikatorze pozycji, czyli wiersza. */
  private async downloadByRowId(itemId: string): Promise<void> {
    const uuid = itemId.split(':')[1];
    const vm = uuid ? this.multimediaOrchestrator.getOne(uuid)() : undefined;

    if (!vm) {
      return;
    }

    if (!(await this.downloadService.download(vm))) {
      this.toast.show({
        message: PRODUCT_KEYS.base.multimedia.toast.downloadFailed,
        appearance: 'negative',
      });
    }
  }

  /**
   * Pobranie WSKAZANYCH plików. Akcja jest bramkowana zasięgiem `explicit`, więc lista
   * zaznaczonych wierszy jest tu pełna, a nie próbką.
   *
   * Ten sam plik wiszący pod dwoma produktami daje dwa wiersze, ale ma się pobrać raz —
   * odsiewamy po uuid zasobu, nie po identyfikatorze wiersza.
   */
  protected onDownloadSelected(): Promise<void> {
    const uuids = [...this.tabStore.selectedMultimedia()];
    return this.downloadResolved(uuids);
  }

  /**
   * Pobranie wszystkich plików produktów objętych panelem — również bramkowane zasięgiem
   * (patrz komentarz przy akcji toolbara).
   */
  protected onDownloadAll(): Promise<void> {
    const uuids = [...new Set(this._rows().map(row => row.uuid))];
    return this.downloadResolved(uuids);
  }

  /**
   * Wspólna droga obu pobrań paczkowych.
   *
   * Szczegóły plików (nazwa, na którą zapisze je przeglądarka) doładowują się leniwie razem
   * ze scrollem, więc przed pobraniem trzeba się upewnić, że są — inaczej „pobierz wszystkie"
   * wydałoby pliki bez nazw albo pominęło te, do których użytkownik nie doscrollował.
   */
  private async downloadResolved(uuids: readonly string[]): Promise<void> {
    if (uuids.length === 0) {
      return;
    }

    this.ensureMultimediaLoaded(uuids);
    await this.multimediaOrchestrator.loadAsync([...uuids]);

    const items = uuids
      .map(uuid => this.multimediaOrchestrator.getOne(uuid)())
      .filter((vm): vm is MultimediaVM => !!vm);

    if (items.length === 0) {
      this.toast.show({ message: PRODUCT_KEYS.base.multimedia.toast.downloadFailed, appearance: 'negative' });
      return;
    }

    // Zapowiedź przed pierwszym plikiem: pobranie paczki to N osobnych pobrań przeglądarki,
    // a nie jedno archiwum — użytkownik ma wiedzieć, na co patrzy, zanim posypią się pytania
    // o zgodę na pobieranie wielu plików.
    this.toast.show({
      message: { key: PRODUCT_KEYS.base.multimedia.toast.downloadStarted, params: { count: items.length } },
      appearance: 'info',
    });

    const result = await this.downloadService.downloadMany(items);

    if (result.failed > 0) {
      this.toast.show({
        message: { key: PRODUCT_KEYS.base.multimedia.toast.downloadPartial, params: result },
        appearance: 'warning',
      });
    }

    // Osobny komunikat, bo to nie jest porażka: te zasoby nigdy nie leżały w naszym magazynie
    // i pobrać ich stąd nie sposób. Milczenie zostawiłoby użytkownika z paczką krótszą, niż
    // się spodziewał, bez wyjaśnienia dlaczego.
    if (result.skippedExternal > 0) {
      this.toast.show({
        message: {
          key: PRODUCT_KEYS.base.multimedia.toast.downloadSkippedExternal,
          params: { count: result.skippedExternal },
        },
        appearance: 'info',
      });
    }
  }

  /** Zamawia szczegóły tych zasobów, o które jeszcze nie prosiliśmy (wspólna dedupikacja ze scrollem). */
  private ensureMultimediaLoaded(uuids: readonly string[]): void {
    const missing = uuids.filter(uuid => !this.requestedMultimediaUuids.has(uuid));

    if (missing.length === 0) {
      return;
    }

    for (const uuid of missing) {
      this.requestedMultimediaUuids.add(uuid);
    }

    this.multimediaOrchestrator.loadAsync(missing);
  }
}

/** Identyfikator pozycji podglądu = identyfikator wiersza tabeli (para produkt+plik). */
function previewItemId(row: MultimediaRow): string {
  return `${row.productUuid}:${row.uuid}`;
}

/** Podpis pod nazwą pliku: typ i rozmiar — dane, nie klucze tłumaczeń. */
function formatPreviewCaption(vm: MultimediaVM): string {
  return [vm.mimeType, formatBytes(vm.fileSize)].filter(Boolean).join(' · ');
}

function formatBytes(bytes: number): string {
  if (!bytes) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${parseFloat((bytes / Math.pow(1024, exponent)).toFixed(1))} ${units[exponent]}`;
}
