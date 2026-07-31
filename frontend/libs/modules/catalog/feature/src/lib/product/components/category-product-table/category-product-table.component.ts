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
} from '@erp/catalog/data-access';
import { ErpUserPreferencesService, ErpPreferencesType } from '@erp/shared/data-access';

import { PRODUCT_KEYS } from '../../translation';

@Component({
  selector: 'erp-category-product-table',
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
export class CategoryProductTableComponent {
  private readonly catalogProductOrchestrator = inject(CatalogProductOrchestrator);
  private readonly preferences = inject(ErpUserPreferencesService);
  private saveTimeout: any;

  /** Filtry przekazywane z zewnątrz (np. wyszukiwanie) */
  filters = input<SearchProductRequest>({});

  /** Klucz stanu tabeli (wymagany jeśli chcemy zachowywać stan) */
  stateKey = input<string>();

  /** Zdarzenie zmiany zaznaczenia wybrane w tabeli */
  selectionChange = output<ErpSelectionState<ProductVM>>();

  /** Zdarzenie emitowane podczas rozpoczęcia i zakończenia pobierania danych */
  loadingChange = output<boolean>();

  // ── Stan wewnętrzny ──
  private readonly currentUuids = signal<string[]>([]);
  private readonly totalCount = signal<number>(0);
  private readonly loading = signal<boolean>(false);
  
  private readonly tableComponent = viewChild(ErpTableComponent);

  // Zapisany ostatni stan tabeli (paginacja, sortowanie)
  private lastTableState: ErpTableState | null = null;

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
    const key = this.stateKey();
    let initialState: Partial<ErpTableState> | undefined = undefined;
    
    if (key) {
      initialState = untracked(() => this.preferences.getState(ErpPreferencesType.Table, key));
    }

    const builder = new ErpTableBuilder<ProductVM>()
      .setMode('server')
      .setRowIdAccessor(x => x.uuid)
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
        .addColumn((c) => c
          .setId('sku')
          .setAccessorKey('sku')
          .setHeader(PRODUCT_KEYS.base.table.columns.sku)
          .setSize(180)
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

      if (initialState) {
        builder.setInitialState(initialState);
      }

      builder.setOnStateChange((state) => {
        const dataStateChanged = !this.lastTableState ||
          JSON.stringify(this.lastTableState.pagination) !== JSON.stringify(state.pagination) ||
          JSON.stringify(this.lastTableState.sorting) !== JSON.stringify(state.sorting);

        this.lastTableState = state;
        if (key) {
          clearTimeout(this.saveTimeout);
          this.saveTimeout = setTimeout(() => {
            const stateToSave: ErpTableState = {
              ...state,
              selection: {
                isAllSelected: false,
                selectedIds: [],
                filters: {},
              },
            };
            this.preferences.saveState(ErpPreferencesType.Table, key, stateToSave);
          }, 400);
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

  private async fetchData(filters: SearchProductRequest, tableState: ErpTableState | null): Promise<void> {
    this.loading.set(true);
    this.loadingChange.emit(true);
    try {
      const request: SearchProductRequest = {
        ...filters,
        page: tableState?.pagination?.pageIndex ?? 0,
        pageSize: tableState?.pagination?.pageSize ?? 20,
      };

      if (tableState?.sorting && tableState.sorting.length > 0) {
        request.sorts = tableState.sorting.map((sort) => ({
          field: sort.columnId,
          order: sort.direction === 'asc' ? 1 : -1,
        }));
      }

      const response = await this.catalogProductOrchestrator.searchAsync(request, {
        autoLoad: true,
        loadOptions: {
          includeCategories: true,
          includeModel: true,
        },
      });

      this.currentUuids.set(response.uuids ?? []);
      this.totalCount.set(response.totalCount ?? 0);
    } catch (error) {
      console.error('[CategoryProductTableComponent] Error fetching data:', error);
      this.currentUuids.set([]);
      this.totalCount.set(0);
    } finally {
      this.loading.set(false);
      this.loadingChange.emit(false);
    }
  }
}
