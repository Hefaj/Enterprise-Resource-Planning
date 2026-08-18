import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  effect,
  untracked,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  ErpTableComponent,
  ErpTableBuilder,
  ErpTableState,
  ErpTableConfig,
  ErpSelectionState,
} from '@erp/shared/ui';

import {
  CatalogProductOrchestrator,
  ProductVM,
  SearchProductRequest,
  CategoryVM,
  ProductCodeVM,
  SortOption,
} from '@erp/catalog/data-access';

import { PRODUCT_KEYS } from '../../translation';

@Component({
  selector: 'erp-catalog-product-table',
  standalone: true,
  imports: [CommonModule, ErpTableComponent],
  template: `
    <erp-table
      class="block h-full w-full"
      [config]="tableConfig()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogProductTableComponent {
  private readonly catalogProductOrchestrator = inject(CatalogProductOrchestrator);

  /** Filtry przekazywane z zewnątrz (np. wyszukiwanie) */
  filters = input<SearchProductRequest>({});

  /** Klucz stanu tabeli (wymagany jeśli chcemy zachowywać stan) */
  stateKey = input<string>();

  /** Zdarzenie zmiany zaznaczenia wybrane w tabeli */
  selectionChange = output<ErpSelectionState<ProductVM>>();

  /** Zdarzenie emitowane podczas rozpoczęcia i zakończenia pobierania danych */
  loadingChange = output<boolean>();

  /**
   * Aktualne sortowanie tabeli w postaci kontraktu HTTP. Sortowanie żyje w stanie tabeli, a nie
   * w filtrach — a strona potrzebuje go, gdy sama odpytuje API o listę uuidów („Zaznacz wszystko"
   * rozwiązane do identyfikatorów, podgląd zakładek). Bez tego panele boczne pokazywałyby
   * produkty w domyślnej kolejności backendu, a nie w tej, którą widać w tabeli.
   */
  sortsChange = output<SortOption[] | undefined>();

  // ── Stan wewnętrzny ──
  private readonly currentUuids = signal<string[]>([]);
  private readonly totalCount = signal<number>(0);
  private readonly loading = signal<boolean>(false);
  
  private readonly tableComponent = viewChild(ErpTableComponent);

  // Zapisany ostatni stan tabeli (paginacja, sortowanie)
  private lastTableState: ErpTableState | null = null;

  public clearSelection(): void {
    this.tableComponent()?.clearSelection();
  }

  /** Zmapowane modele widoku z pobranych UUIDów */
  items = computed<ProductVM[]>(() => {
    const uuids = this.currentUuids();
    const vmMap = this.catalogProductOrchestrator.getViewModel()();
    
    return uuids
      .map(uuid => vmMap.get(uuid))
      .filter((vm): vm is ProductVM => vm !== undefined);
  });

  constructor() {
    // Reaguj na zmiany filtrów i pobierz dane z zachowaniem aktualnego stanu tabeli
    effect(() => {
      const currentFilters = this.filters();
      
      untracked(() => {
        try {
          this.tableComponent()?.clearSelection();
        } catch (e) {
          // Ignoruj błąd gdy komponent tabeli nie ma jeszcze przekazanego inputa [config]
        }
      });

      // Nie pobieraj przy pierwszej inicjalizacji, zanim tabela nie wyemituje swojego początkowego stanu.
      // Pobraniem danych przy pierwszym wejściu zajmie się builder.setOnStateChange
      if (this.lastTableState !== null) {
        this.fetchData(currentFilters, this.lastTableState);
      }
    });
  }

  tableConfig = computed<ErpTableConfig<ProductVM>>(() => {
    const builder = new ErpTableBuilder<ProductVM>()
      .setMode('server')
      .setRowIdAccessor(x => x.uuid)
      // Filtry muszą trafić do konfiguracji tabeli, bo przy „Zaznacz wszystko" to one
      // (a nie lista uuidów) opisują zaznaczenie i wracają w `ErpSelectionState.filters`.
      .setFilters(this.filters)
      .setStateKey(this.stateKey())
      .setEnableVirtualScroll(true)
      .setEstimatedRowHeight(50)
      .setDefaultPageSize(20)
      .setPageSizeOptions([10, 20, 50, 100])
      .setSelectionMode('multi')
      .setItems(this.items)
      .setItemCount(this.totalCount)
      .setLoading(this.loading)
      .setEmptyMessage(PRODUCT_KEYS.base.table.emptyMessage)

      .addColumn((c) => c.setId('id').setAccessorKey('uuid').setHeader('UUID'))

      // ── Identyfikacja ──
      .addColumnGroup((g) => g
        .setId('identification')
        .setHeader(PRODUCT_KEYS.base.table.groups.identification)
        // SKU nie jest już polem produktu, tylko jednym z jego kodów — kolumna wyciąga go
        // po symbolu typu ze słownika. Sortowanie wyłączone, bo backend sortuje po kolumnach
        // produktu, a kod mieszka w tabeli podrzędnej; posortowanie po nim wymaga wskazania,
        // PO KTÓRYM typie kodu, czyli parametru, którego kontrakt sortowania nie ma.
        .addColumn((c) => c
          .setId('sku')
          .setAccessorKey('codes')
          .setHeader(PRODUCT_KEYS.base.table.columns.sku)
          .setEnableSorting(false)
          .setSize(180)
          .setCellRichContent((codes: ProductCodeVM[]) => {
            const sku = codes?.find(code => code.codeType?.symbol === 'SKU')?.value;
            return { lines: [{ text: sku ?? PRODUCT_KEYS.base.table.emptyCell }] };
          })
        )
        .addColumn((c) => c
          .setId('name')
          .setAccessorKey('name')
          .setHeader(PRODUCT_KEYS.base.table.columns.name)
          // .setSize(300)
        )
      )

      // ── Szczegóły ──
      .addColumnGroup((g) => g
        .setId('details')
        .setHeader(PRODUCT_KEYS.base.table.groups.details)
        .addColumn((c) => c
          .setId('categories')
          .setAccessorKey('categories')
          .setHeader(PRODUCT_KEYS.base.table.columns.categories)
          .setEnableSorting(false)
          .setSize(240)
          .setCellRichContent((categories: CategoryVM[]) => {
             if (!categories || categories.length === 0) return { lines: [{ text: PRODUCT_KEYS.base.table.emptyCell }] };
             return {
               lines: categories.map((cat) => ({
                 text: cat.name,
               }))
             };
          })
        )
        .addColumn((c) => c
          .setId('status')
          .setAccessorKey('status')
          .setHeader(PRODUCT_KEYS.base.table.columns.status)
          .setSize(150)
        )
        .addColumn((c) => c
          .setId('price')
          .setAccessorKey('price')
          .setHeader(PRODUCT_KEYS.base.table.columns.price)
          .setAlign('right')
          .setSize(150)
        )
      );

      builder.setOnStateChange((state) => {
        const sortingChanged = !this.lastTableState ||
          JSON.stringify(this.lastTableState.sorting) !== JSON.stringify(state.sorting);
        const dataStateChanged = !this.lastTableState ||
          JSON.stringify(this.lastTableState.pagination) !== JSON.stringify(state.pagination) ||
          sortingChanged;

        this.lastTableState = state;

        if (sortingChanged) {
          this.sortsChange.emit(this.toSorts(state));
        }

        if (dataStateChanged) {
          this.fetchData(this.filters(), state);
        }
      })
      .setOnSelectionChange((state) => {
        this.selectionChange.emit(state);
      });

      return builder.build();
  });

  /** Sortowanie tabeli → kontrakt HTTP (`SortOption`). Jedno miejsce dla zapytania i dla strony. */
  private toSorts(tableState: ErpTableState | null): SortOption[] | undefined {
    if (!tableState?.sorting || tableState.sorting.length === 0) return undefined;

    return tableState.sorting.map((sort) => ({
      field: sort.columnId,
      order: sort.direction === 'asc' ? 1 : -1,
    }));
  }

  private async fetchData(filters: SearchProductRequest, tableState: ErpTableState | null): Promise<void> {
    this.loading.set(true);
    this.loadingChange.emit(true);
    try {
      const request: SearchProductRequest = {
        ...filters,
        // `pageIndex` z ErpTable liczy się od zera, `page` w kontrakcie HTTP (`PagedRequest`)
        // od jedynki — bez tego przesunięcia backend klampuje 0 do 1 i pierwsze dwie strony
        // tabeli zwracają ten sam zbiór, a ostatnia jest nieosiągalna.
        page: (tableState?.pagination?.pageIndex ?? 0) + 1,
        pageSize: tableState?.pagination?.pageSize ?? 20,
      };

      const sorts = this.toSorts(tableState);
      if (sorts) {
        request.sorts = sorts;
      }

      const response = await this.catalogProductOrchestrator.searchAsync(request, {
        autoLoad: true,
        loadOptions: {
          includeCategories: true,
          includeModel: true,
          // Bez słownika typów kodów kolumna SKU nie ma jak rozpoznać, który kod jest którym.
          includeCodeTypes: true,
        },
      });

      this.currentUuids.set(response.uuids ?? []);
      this.totalCount.set(response.totalCount ?? 0);
    } catch (error) {
      console.error('[CatalogProductTableComponent] Error fetching data:', error);
      this.currentUuids.set([]);
      this.totalCount.set(0);
    } finally {
      this.loading.set(false);
      this.loadingChange.emit(false);
    }
  }
}
