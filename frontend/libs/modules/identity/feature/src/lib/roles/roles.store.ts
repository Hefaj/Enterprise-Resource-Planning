import { Injectable, computed, signal } from '@angular/core';
import { RoleVM } from '@erp/identity/data-access';
import { ErpSelectionScope, ErpSelectionState } from '@erp/shared/ui';

/**
 * Stan strony `/identity/roles`. Bez filtrów (w odróżnieniu od `UsersStore`) — strona ładuje
 * WSZYSTKIE role na starcie (dziesiątki, nie tysiące, patrz `docs/backend/identity-authz.md`
 * §2), bo `RoleOrchestrator.getContainerRoles()` ("zawarta w") wymaga pełnego zbioru
 * załadowanego w cache, żeby dać poprawny wynik.
 *
 * <b>Zasięg zaznaczenia jest tu PROSTSZY niż `UsersStore`/`ProductStore`.</b> Tabela ról działa
 * w trybie `client` (`IdentityRolesTableComponent`) — CAŁY zbiór jest już w pamięci, więc
 * „Zaznacz wszystko" nie opisuje filtra o nieznanej liczności: `ErpTableComponent` i tak zwraca
 * kompletną, natychmiastową listę `selectedIds` niezależnie od `isAllSelected`. Zasięg `query`
 * (materializacja, próbka, baner ostrzegawczy z `docs/frontend/selection-scope.md` §2) nie ma
 * tu odpowiednika — nie ma czego materializować, gdy wszystko już jest w cache.
 */
@Injectable()
export class RolesStore {
  public readonly loading = signal<boolean>(false);

  public setLoading(isLoading: boolean): void {
    this.loading.set(isLoading);
  }

  public readonly selection = signal<ErpSelectionState<RoleVM> | null>(null);

  public setSelection(state: ErpSelectionState<RoleVM>): void {
    this.selection.set(state);
  }

  public clearSelection(): void {
    this.selection.set({ mode: 'client', isAllSelected: false, selectedItems: [], selectedIds: [] });
  }

  public readonly scope = computed<ErpSelectionScope<RoleVM, never>>(() => {
    const selection = this.selection();
    const ids = selection?.selectedIds ?? [];

    if (ids.length === 0) {
      return { kind: 'none' };
    }

    return {
      kind: 'explicit',
      ids,
      items: selection?.selectedItems ?? [],
      count: ids.length,
      materialized: false,
      loading: false,
    };
  });

  public readonly scopeKind = computed(() => this.scope().kind);

  /** Panel szczegółów (zakładki Uprawnienia/Role składowe/Zawarta w/Kto ma tę rolę) czyta TEN
   * sygnał — pokazuje dane dokładnie jednej roli, więc ma sens tylko przy zaznaczeniu
   * dokładnie jednego wiersza. Patrz analogiczny `UsersStore.selectedUuid`. */
  public readonly selectedUuid = computed<string | null>(() => {
    const scope = this.scope();
    return scope.kind === 'explicit' && scope.ids.length === 1 ? scope.ids[0] : null;
  });
}
