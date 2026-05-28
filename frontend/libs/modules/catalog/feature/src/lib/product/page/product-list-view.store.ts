import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { CatalogProductOrchestrator, SearchProductRequest } from '@erp/catalog/data-access';

@Injectable() // Rejestrowany na poziomie komponentu strony (Route/Page Component), aby żył tylko tyle co widok
export class ProductListViewStore {
  private orchestrator = inject(CatalogProductOrchestrator);

  // 1. Stan UI (Sygnały)
  readonly filters = signal<Partial<SearchProductRequest>>({});
  readonly page = signal<number>(1);
  readonly pageSize = signal<number>(20);

  // 2. Stan Danych (Wynik wyszukiwania)
  readonly searchResultUuids = signal<string[]>([]);
  readonly totalCount = signal<number>(0); // Niezbędne do paginacji w tabeli!
  readonly isLoading = signal<boolean>(false);

  // 3. Połączone parametry zapytania
  private readonly currentQuery = computed(() => ({
    ...this.filters(),
    page: this.page(),
    pageSize: this.pageSize()
  }));

  constructor() {
    // 4. Efekt nasłuchujący na zmiany w filtrach lub paginacji
    effect(() => {
      const query = this.currentQuery();
      this.fetchData(query);
    }, { allowSignalWrites: true });
  }

  // 5. Metody mutujące stan dla komponentów
  updateFilters(newFilters: Partial<SearchProductRequest>): void {
    this.filters.set(newFilters);
    this.page.set(1); // Zmiana filtrów zawsze resetuje paginację do 1 strony!
  }

  updatePagination(page: number, pageSize: number): void {
    this.page.set(page);
    this.pageSize.set(pageSize);
  }

  // 6. Główna logika komunikacji z Orkiestratorem
  private async fetchData(query: SearchProductRequest): Promise<void> {
    this.isLoading.set(true);
    try {
      // UWAGA: Aby paginacja w tabeli działała, API/Orkiestrator musi zwrócić nie tylko UUIDs, 
      // ale też całkowitą liczbę elementów (TotalCount) spełniających filtry.
      const result = await this.orchestrator.searchAsync(query, {
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
