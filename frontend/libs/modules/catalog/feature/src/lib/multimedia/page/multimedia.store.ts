import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { CatalogMultimediaOrchestrator, MultimediaVM, SearchMultimediaRequest, SortOption } from '@erp/catalog/data-access';
import {
  ErpSelectionScope,
  ErpSelectionState,
  erpResolveSelectionScope,
  erpSelectionCount,
} from '@erp/shared/ui';

/**
 * Do ilu plików „Zaznacz wszystko" jest jeszcze rozwiązywane do listy identyfikatorów.
 *
 * Wyżej niż przy produktach (100), bo zasób jest tu bytem płaskim: nie ma zależności do
 * doładowania, a orkiestrator i tak chunkuje żądania. Powyżej progu zaznaczenie zostaje
 * filtrem i akcje lecą przez `targetFilter` — patrz docs/frontend/selection-scope.md.
 */
export const MULTIMEDIA_SELECTION_MATERIALIZE_LIMIT = 500;

/**
 * Store strony biblioteki mediów — filtry, sortowanie, zaznaczenie i jego zasięg.
 *
 * Świadomie cieńszy niż `ProductStore`: nie ma paneli bocznych, więc nie ma potrzeby
 * rozwiązywania podglądów. Zostaje sama materializacja „Zaznacz wszystko", bo bez niej
 * usunięcie kilkunastu zaznaczonych plików szłoby filtrem, a nie listą — czyli obejmowałoby
 * też to, co dojechało do tabeli po zaznaczeniu.
 */
@Injectable()
export class MultimediaStore {
  private readonly orchestrator = inject(CatalogMultimediaOrchestrator);

  public readonly filters = signal<Partial<SearchMultimediaRequest>>({});

  public setFilters(newFilters: Partial<SearchMultimediaRequest>): void {
    this._uuidCache.clear();
    this.filters.set(newFilters);
  }

  public updateFilters(partial: Partial<SearchMultimediaRequest>): void {
    this._uuidCache.clear();
    this.filters.update(f => ({ ...f, ...partial }));
  }

  /** Wymuszenie ponownego pobrania bez zmiany kryteriów — nowa referencja filtrów. */
  public refresh(): void {
    this._uuidCache.clear();
    this.filters.update(f => ({ ...f }));
  }

  public readonly sorts = signal<SortOption[] | undefined>(undefined);

  public setSorts(sorts: SortOption[] | undefined): void {
    if (JSON.stringify(sorts ?? []) === JSON.stringify(this.sorts() ?? [])) return;
    this._uuidCache.clear();
    this.sorts.set(sorts);
  }

  public readonly selection = signal<ErpSelectionState<MultimediaVM> | null>(null);

  public setSelection(state: ErpSelectionState<MultimediaVM>): void {
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

  public readonly loading = signal<boolean>(false);

  public setLoading(isLoading: boolean): void {
    this.loading.set(isLoading);
  }

  private readonly _materialized = signal<{ token: string; uuids: string[] } | null>(null);
  private readonly _uuidCache = new Map<string, string[]>();

  public readonly scope = computed<ErpSelectionScope<MultimediaVM, SearchMultimediaRequest>>(() => {
    const selection = this.selection();
    const materialized = this._materialized();
    const token = this._filterToken(selection?.filters);

    return erpResolveSelectionScope<MultimediaVM, SearchMultimediaRequest>(selection, {
      materializeLimit: MULTIMEDIA_SELECTION_MATERIALIZE_LIMIT,
      materializedIds: materialized?.token === token ? materialized.uuids : null,
    });
  });

  public readonly scopeKind = computed(() => this.scope().kind);

  constructor() {
    effect(() => {
      const selection = this.selection();
      this.sorts();

      if (!selection?.isAllSelected) {
        untracked(() => this._materialized.set(null));
        return;
      }

      const count = erpSelectionCount(selection);
      if (count === 0 || count > MULTIMEDIA_SELECTION_MATERIALIZE_LIMIT) {
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

  public async resolveUuids(filters: Partial<SearchMultimediaRequest>, limit: number): Promise<string[]> {
    const key = `${this._filterToken(filters)}|${limit}`;
    const cached = this._uuidCache.get(key);
    if (cached) return cached;

    const response = await this.orchestrator.searchAsync(
      { ...filters, sorts: this.sorts(), page: 1, pageSize: limit } as SearchMultimediaRequest,
      { autoLoad: true },
    );

    const uuids = response.uuids ?? [];
    this._uuidCache.set(key, uuids);
    return uuids;
  }

  private async _materialize(token: string, filters: Record<string, unknown>, count: number): Promise<void> {
    const uuids = await this.resolveUuids(filters, count);

    if (this._filterToken(this.selection()?.filters) !== token) return;

    this._materialized.set({ token, uuids });
  }

  private _filterToken(filters: Record<string, unknown> | null | undefined): string {
    return JSON.stringify({ filters: filters ?? {}, sorts: this.sorts() ?? [] });
  }
}
