import { Injectable, computed, signal } from '@angular/core';
import { PermissionCatalogVM } from '@erp/identity/data-access';
import { ErpSelectionScope, ErpSelectionState } from '@erp/shared/ui';

/**
 * Współdzielony stan strony `/identity/permissions`: wyszukiwana fraza (filtr po lewej) i
 * zaznaczenie uprawnień dla panelu „kto ma uprawnienie". Strona jest w 100% read-only (patrz
 * `docs/architecture/security.md` §3) — ten store istnieje głównie po to, żeby niezależne
 * obszary siatki (`filter`/`content`/`rightPanel`, wypełniane przez `ErpGridLayoutBuilder.fill()`)
 * mogły się komunikować przez wspólny injector strony.
 *
 * <b>Zasięg jest tu PROSTY, jak w `RolesStore`.</b> Katalog uprawnień jest w całości w pamięci
 * (backend celowo nie paginuje), więc tabela działa w trybie `client`, a „Zaznacz wszystko"
 * zawsze zwraca komplet identyfikatorów — zasięg `query` (materializacja, próbka) nie ma tu
 * odpowiednika.
 */
@Injectable()
export class PermissionsStore {
  public readonly search = signal<string>('');

  public setSearch(search: string): void {
    this.search.set(search);
  }

  public readonly selection = signal<ErpSelectionState<PermissionCatalogVM> | null>(null);

  public setSelection(state: ErpSelectionState<PermissionCatalogVM>): void {
    this.selection.set(state);
  }

  public clearSelection(): void {
    this.selection.set({ mode: 'client', isAllSelected: false, selectedItems: [], selectedIds: [] });
  }

  /** Identyfikatorem uprawnienia jest jego `code` — katalog nie ma własnych UUID-ów. */
  public readonly scope = computed<ErpSelectionScope<PermissionCatalogVM, never>>(() => {
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
}
