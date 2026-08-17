import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { CatalogProductOrchestrator, SearchProductRequest, ProductVM } from '@erp/catalog/data-access';
import {
  ErpSelectionScope,
  ErpSelectionState,
  erpResolveSelectionScope,
  erpSelectionCount,
} from '@erp/shared/ui';

/**
 * Do ilu produktów „Zaznacz wszystko" jest jeszcze rozwiązywane do listy identyfikatorów.
 *
 * Próg dobrany po liczbie PRODUKTÓW, nie plików: to produkty generują żądania (orkiestrator
 * chunkuje po 100, więc mieścimy się w jednym), a szczegóły pozycji podrzędnych i tak
 * doładowują się leniwie w miarę scrollowania. Powyżej progu zaznaczenie zostaje filtrem.
 */
export const PRODUCT_SELECTION_MATERIALIZE_LIMIT = 100;

@Injectable() // Rejestrowany na poziomie komponentu strony (Route/Page Component), aby żył tylko tyle co widok
export class ProductStore {
  private readonly orchestrator = inject(CatalogProductOrchestrator);

  // 1. Stan globalnych filtrów strony
  public readonly filters = signal<Partial<SearchProductRequest>>({
    territoryCode: 'DE', // domyślne dla testu
  });

  public setFilters(newFilters: Partial<SearchProductRequest>): void {
    this._uuidCache.clear();
    this.filters.set(newFilters);
  }

  public updateFilters(partial: Partial<SearchProductRequest>): void {
    this._uuidCache.clear();
    this.filters.update(f => ({ ...f, ...partial }));
  }

  // 2. Zaznaczenia w tabeli produktów — odczytywane też przez zakładki multimedia/gwarancje,
  // które renderują grupy na podstawie zaznaczonych tu produktów.
  public readonly selection = signal<ErpSelectionState<ProductVM> | null>(null);

  public setSelection(state: ErpSelectionState<ProductVM>): void {
    this.selection.set(state);
  }

  public clearSelection(): void {
    this._materialized.set(null);
    this.selection.set({
      mode: 'server',
      isAllSelected: false,
      selectedItems: [],
      selectedIds: [],
    });
  }

  // 3. Stan ładowania
  public readonly loading = signal<boolean>(false);

  public setLoading(isLoading: boolean): void {
    this.loading.set(isLoading);
  }

  // 4. Zasięg zaznaczenia — jedno źródło prawdy dla paneli bocznych i celów operacji masowych.
  //
  // Panele NIE powinny czytać `selection` wprost: przy „Zaznacz wszystko" `selectedItems` jest
  // puste (zaznaczenie opisuje filtr), więc naiwny odczyt kończy się pustym widokiem mimo
  // tysięcy zaznaczonych pozycji.

  /** Wynik materializacji „Zaznacz wszystko" — ważny wyłącznie dla filtrów, dla których powstał. */
  private readonly _materialized = signal<{ token: string; uuids: string[] } | null>(null);

  /** Rozwiązane listy identyfikatorów per (filtry, limit) — współdzielone z podglądami paneli. */
  private readonly _uuidCache = new Map<string, string[]>();

  public readonly scope = computed<ErpSelectionScope<ProductVM, SearchProductRequest>>(() => {
    const selection = this.selection();
    const materialized = this._materialized();
    const token = this._filterToken(selection?.filters);

    return erpResolveSelectionScope<ProductVM, SearchProductRequest>(selection, {
      materializeLimit: PRODUCT_SELECTION_MATERIALIZE_LIMIT,
      materializedIds: materialized?.token === token ? materialized.uuids : null,
    });
  });

  public readonly scopeKind = computed(() => this.scope().kind);

  constructor() {
    // Materializacja małych zaznaczeń „wszystko": zamiast trzymać UI w trybie ograniczonym dla
    // pięciu produktów, rozwiązujemy filtr do listy uuidów i od tego momentu wszystko (panele,
    // cele operacji) zachowuje się jak przy ręcznym zaznaczeniu.
    effect(() => {
      const selection = this.selection();
      if (!selection?.isAllSelected) {
        untracked(() => this._materialized.set(null));
        return;
      }

      const count = erpSelectionCount(selection);
      if (count === 0 || count > PRODUCT_SELECTION_MATERIALIZE_LIMIT) {
        untracked(() => this._materialized.set(null));
        return;
      }

      const token = this._filterToken(selection.filters);
      untracked(() => {
        if (this._materialized()?.token === token) return;
        void this._materialize(token, selection.filters ?? {}, count);
      });
    });
  }

  /**
   * Rozwiązuje filtr do listy identyfikatorów produktów (z auto-ładowaniem ich do cache
   * orkiestratora). Używane zarówno przy materializacji zaznaczenia, jak i przez panele boczne
   * budujące PODGLĄD kilku pierwszych produktów w trybie filtra.
   */
  public async resolveUuids(filters: Partial<SearchProductRequest>, limit: number): Promise<string[]> {
    const key = `${this._filterToken(filters)}|${limit}`;
    const cached = this._uuidCache.get(key);
    if (cached) return cached;

    const response = await this.orchestrator.searchAsync(
      { ...filters, page: 1, pageSize: limit } as SearchProductRequest,
      { autoLoad: true },
    );

    const uuids = response.uuids ?? [];
    this._uuidCache.set(key, uuids);
    return uuids;
  }

  private async _materialize(
    token: string,
    filters: Record<string, any>,
    count: number,
  ): Promise<void> {
    const uuids = await this.resolveUuids(filters, count);

    // Zaznaczenie mogło się w międzyczasie zmienić — wynik dla nieaktualnych filtrów odrzucamy,
    // inaczej panel pokazałby produkty z poprzedniego zaznaczenia.
    if (this._filterToken(this.selection()?.filters) !== token) return;

    this._materialized.set({ token, uuids });
  }

  private _filterToken(filters: Record<string, any> | null | undefined): string {
    return JSON.stringify(filters ?? {});
  }
}
