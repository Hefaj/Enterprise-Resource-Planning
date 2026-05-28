import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { CatalogProductOrchestrator, SearchProductRequest } from '@erp/catalog/data-access';

@Injectable() // Rejestrowany na poziomie komponentu strony (Route/Page Component), aby żył tylko tyle co widok
export class ProductListViewStore {
  private readonly _orchestrator = inject(CatalogProductOrchestrator);

  // 1. Stan UI (Sygnały)
  public readonly filters = signal<Partial<SearchProductRequest>>({});
  public readonly page = signal<number>(1);
  public readonly pageSize = signal<number>(20);
  public readonly sortField = signal<string | undefined>(undefined);
  public readonly sortOrder = signal<number | undefined>(undefined);

  // 2. Stan Danych (Wynik wyszukiwania)
  public readonly searchResultUuids = signal<string[]>([]);
  public readonly totalCount = signal<number>(0); // Niezbędne do paginacji w tabeli!
  public readonly isLoading = signal<boolean>(false);

  // 3. Połączone parametry zapytania
  private readonly _currentQuery = computed(() => ({
    ...this.filters(),
    page: this.page(),
    pageSize: this.pageSize(),
    sortField: this.sortField(),
    sortOrder: this.sortOrder()
  }));

  // Konfiguracja: Czy załadować dane przy inicjalizacji widoku?
  public readonly autoload = signal<boolean>(false);

  private _isInitial = true;

  public constructor() {
    // 4. Efekt nasłuchujący na zmiany w filtrach lub paginacji
    effect(() => {
      const query = this._currentQuery();
      const shouldAutoload = this.autoload();

      if (this._isInitial) {
        this._isInitial = false;
        if (!shouldAutoload) {
          return;
        }
      }

      this._fetchData(query);
    });
  }

  // 5. Metody mutujące stan dla komponentów
  public updateFilters(newFilters: Partial<SearchProductRequest>): void {
    this.filters.set(newFilters);
    this.page.set(1); // Zmiana filtrów zawsze resetuje paginację do 1 strony!
  }

  public updatePagination(page: number, pageSize: number): void {
    this.page.set(page);
    this.pageSize.set(pageSize);
  }

  public updateSort(sortField: string | undefined, sortOrder: number | undefined): void {
    this.sortField.set(sortField);
    this.sortOrder.set(sortOrder);
    this.page.set(1); // Zmiana sortowania resetuje paginację do 1 strony!
  }

  // 6. Główna logika komunikacji z Orkiestratorem
  private async _fetchData(query: SearchProductRequest): Promise<void> {
    this.isLoading.set(true);
    try {
      // UWAGA: Aby paginacja w tabeli działała, API/Orkiestrator musi zwrócić nie tylko UUIDs, 
      // ale też całkowitą liczbę elementów (TotalCount) spełniających filtry.
      const result = await this._orchestrator.searchAsync(query, {
        autoLoad: true,
        loadOptions: { includeCategories: true, includeModel: true }
      });

      this.searchResultUuids.set(result.uuids ?? []);
      this.totalCount.set(result.totalCount ?? 0); 
    } catch (err) {
      console.error('Product search failed:', err);
      // Obsługa błędów (np. toast)
    } finally {
      this.isLoading.set(false);
    }
  }
}
