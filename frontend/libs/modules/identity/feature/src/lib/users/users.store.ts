import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { UserOrchestrator, UserVM } from '@erp/identity/data-access';
import { SearchUserAccountRequest } from '@erp/identity/data-access';
import { ErpSelectionScope, ErpSelectionState, erpResolveSelectionScope, erpSelectionCount } from '@erp/shared/ui';

/**
 * Do ilu użytkowników „Zaznacz wszystko" jest jeszcze rozwiązywane do listy identyfikatorów —
 * ten sam próg co `PRODUCT_SELECTION_MATERIALIZE_LIMIT` w Catalogu, patrz
 * `docs/frontend/selection-scope.md` §2 „Jak dobrać próg".
 */
export const USER_SELECTION_MATERIALIZE_LIMIT = 100;

/**
 * Stan strony `/identity/users` — filtry, zaznaczenie (`ErpSelectionState`) i zasięg
 * (`ErpSelectionScope`) dla akcji masowych toolbara (patrz `docs/frontend/selection-scope.md`),
 * wzorem `ProductStore`. Osobno: `selectedUuid` — panel szczegółów (zakładki Role/Uprawnienia)
 * pokazuje dane TYLKO gdy zaznaczenie rozwiązuje się do DOKŁADNIE JEDNEGO identyfikatora; przy
 * zaznaczeniu wielu wierszy albo trybie `query` panel się chowa, bo "role tego jednego
 * użytkownika" nie ma sensownego odpowiednika dla zbioru.
 */
@Injectable()
export class UsersStore {
  private readonly _orchestrator = inject(UserOrchestrator);

  public readonly filters = signal<Partial<SearchUserAccountRequest>>({});
  public readonly loading = signal<boolean>(false);

  public updateFilters(partial: Partial<SearchUserAccountRequest>): void {
    this._uuidCache.clear();
    this.filters.update((f) => ({ ...f, ...partial }));
  }

  public setLoading(isLoading: boolean): void {
    this.loading.set(isLoading);
  }

  // ── Zaznaczenie i zasięg — patrz docs/frontend/selection-scope.md §2 ──

  public readonly selection = signal<ErpSelectionState<UserVM> | null>(null);

  public setSelection(state: ErpSelectionState<UserVM>): void {
    this.selection.set(state);
  }

  public clearSelection(): void {
    this._materialized.set(null);
    this.selection.set({ mode: 'server', isAllSelected: false, selectedItems: [], selectedIds: [] });
  }

  private readonly _materialized = signal<{ token: string; uuids: string[] } | null>(null);
  private readonly _uuidCache = new Map<string, string[]>();

  public readonly scope = computed<ErpSelectionScope<UserVM, SearchUserAccountRequest>>(() => {
    const selection = this.selection();
    const materialized = this._materialized();
    const token = this._filterToken(selection?.filters);

    return erpResolveSelectionScope<UserVM, SearchUserAccountRequest>(selection, {
      materializeLimit: USER_SELECTION_MATERIALIZE_LIMIT,
      materializedIds: materialized?.token === token ? materialized.uuids : null,
    });
  });

  public readonly scopeKind = computed(() => this.scope().kind);

  /** Panel szczegółów (zakładki Role/Uprawnienia/Efektywne) czyta TEN sygnał, nigdy `scope`
   * wprost — pokazuje dane dokładnie jednego użytkownika, więc ma sens tylko dla zasięgu
   * rozwiązanego do pojedynczego identyfikatora (ręczne zaznaczenie JEDNEGO wiersza albo
   * „Zaznacz wszystko" zmaterializowane do jednego trafienia filtra). */
  public readonly selectedUuid = computed<string | null>(() => {
    const scope = this.scope();
    return scope.kind === 'explicit' && scope.ids.length === 1 ? scope.ids[0] : null;
  });

  public constructor() {
    // Materializacja małych zaznaczeń „wszystko" — patrz `ProductStore` (wzorzec identyczny).
    effect(() => {
      const selection = this.selection();
      if (!selection?.isAllSelected) {
        untracked(() => this._materialized.set(null));
        return;
      }

      const count = erpSelectionCount(selection);
      if (count === 0 || count > USER_SELECTION_MATERIALIZE_LIMIT) {
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

  private async _materialize(
    token: string,
    filters: Record<string, any>,
    count: number,
  ): Promise<void> {
    const key = `${token}|${count}`;
    let uuids = this._uuidCache.get(key);
    if (!uuids) {
      const response = await this._orchestrator.searchAsync(
        { ...filters, page: 1, pageSize: count } as SearchUserAccountRequest,
        { autoLoad: true },
      );
      uuids = response.uuids ?? [];
      this._uuidCache.set(key, uuids);
    }

    // Zaznaczenie mogło się w międzyczasie zmienić — wynik dla nieaktualnych filtrów odrzucamy.
    if (this._filterToken(this.selection()?.filters) !== token) return;

    this._materialized.set({ token, uuids });
  }

  private _filterToken(filters: Record<string, any> | null | undefined): string {
    return JSON.stringify(filters ?? {});
  }
}
