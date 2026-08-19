import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ErpTableComponent, ErpTableBuilder, ErpTableState, ErpTableConfig, ErpSelectionState, ErpSelectionMode } from '@erp/shared/ui';
import { UserOrchestrator, UserVM, SearchUserAccountRequest } from '@erp/identity/data-access';

import { USERS_KEYS } from '../translation';

/** Tabela listy użytkowników — domyślnie wybór pojedynczego wiersza (radio, `selectionMode`
 * input, domyślnie `'single'`), nie klik w wiersz. Konsument dostaje uuid wybranego użytkownika
 * (albo `null` przy odznaczeniu) przez `selectionChange`. `selectionMode` jest inputem, nie
 * wartością zaszytą na sztywno w builderze — patrz `docs/frontend/smart-tables.md` §2 (anatomia
 * smart tabeli) i `docs/frontend/pages.md` §10 (częste błędy). */
@Component({
  selector: 'erp-identity-users-table',
  standalone: true,
  imports: [CommonModule, ErpTableComponent],
  template: `<erp-table
    class="block h-full w-full"
    [config]="tableConfig()"
  />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdentityUsersTableComponent {
  private readonly _orchestrator = inject(UserOrchestrator);

  public filters = input<SearchUserAccountRequest>({});
  public stateKey = input<string>();
  public selectionMode = input<ErpSelectionMode>('single');

  public loadingChange = output<boolean>();
  public selectionChange = output<string | null>();

  private readonly _currentUuids = signal<string[]>([]);
  private readonly _totalCount = signal<number>(0);
  private readonly _loading = signal<boolean>(false);

  private _lastTableState: ErpTableState | null = null;

  protected readonly items = computed<UserVM[]>(() => {
    const uuids = this._currentUuids();
    const vmMap = this._orchestrator.getViewModel()();
    return uuids.map((uuid) => vmMap.get(uuid)).filter((vm): vm is UserVM => vm !== undefined);
  });

  public constructor() {
    effect(() => {
      const currentFilters = this.filters();
      untracked(() => {
        if (this._lastTableState !== null) {
          this._fetchData(currentFilters, this._lastTableState);
        }
      });
    });
  }

  protected readonly tableConfig = computed<ErpTableConfig<UserVM>>(() => {
    const builder = new ErpTableBuilder<UserVM>()
      .setMode('server')
      .setRowIdAccessor((x) => x.uuid)
      .setFilters(this.filters)
      .setStateKey(this.stateKey())
      .setEnableVirtualScroll(true)
      .setEstimatedRowHeight(44)
      .setDefaultPageSize(20)
      .setPageSizeOptions([10, 20, 50, 100])
      .setSelectionMode(this.selectionMode())
      .setItems(this.items)
      .setItemCount(this._totalCount)
      .setLoading(this._loading)
      .setEmptyMessage(USERS_KEYS.table.emptyMessage)
      .setOnSelectionChange((state: ErpSelectionState<UserVM>) => this.selectionChange.emit(state.selectedIds[0] ?? null))

      // `UserAccountQueries.SearchAsync` (backend) ignoruje `request.Sorts` — zawsze zwraca
      // `OrderBy(Email)`, bez whitelisty `ApplySorting`. Sortowanie wyłączone na każdej kolumnie,
      // żeby klik w nagłówek nie obiecywał zmiany kolejności, której backend i tak nie wykona
      // (patrz docs/frontend/smart-tables.md §6).
      .addColumn((c) => c.setId('email').setAccessorKey('email').setHeader(USERS_KEYS.table.columns.email).setEnableSorting(false).setSize(280))
      .addColumn((c) =>
        c.setId('displayName').setAccessorKey('displayName').setHeader(USERS_KEYS.table.columns.displayName).setEnableSorting(false).setSize(220),
      )
      .addColumn((c) =>
        c
          .setId('isActive')
          .setAccessorKey('isActive')
          .setHeader(USERS_KEYS.table.columns.isActive)
          .setEnableSorting(false)
          .setSize(120)
          .setCellFormatter((value: boolean) => (value ? '✓' : '—')),
      )
      .addColumn((c) =>
        c
          .setId('roleCount')
          .setAccessorFn((row) => row.roleGrants?.length ?? 0)
          .setHeader(USERS_KEYS.table.columns.roleCount)
          .setEnableSorting(false)
          .setSize(120),
      )

      .setOnStateChange((state) => {
        // Fetch tylko, gdy zmienił się faktyczny zbiór danych (paginacja/sortowanie) — inaczej
        // resize/reorder/visibility kolumn (też emitowane przez `erp-table` przez ten sam
        // callback) strzelałyby zbędnym zapytaniem do API.
        const dataStateChanged =
          !this._lastTableState ||
          JSON.stringify(this._lastTableState.pagination) !== JSON.stringify(state.pagination) ||
          JSON.stringify(this._lastTableState.sorting) !== JSON.stringify(state.sorting);

        this._lastTableState = state;

        if (dataStateChanged) {
          this._fetchData(this.filters(), state);
        }
      });

    return builder.build();
  });

  private async _fetchData(filters: SearchUserAccountRequest, tableState: ErpTableState | null): Promise<void> {
    this._loading.set(true);
    this.loadingChange.emit(true);
    try {
      const request: SearchUserAccountRequest = {
        ...filters,
        page: (tableState?.pagination?.pageIndex ?? 0) + 1,
        pageSize: tableState?.pagination?.pageSize ?? 20,
      };

      // `loadOptions: {}` — nawet pusty obiekt wystarczy, żeby orkiestrator wywołał
      // `resolveEagerDependencies` i dociągnął role przypisane wyszukanym użytkownikom.
      const response = await this._orchestrator.searchAsync(request, { autoLoad: true, loadOptions: {} });

      this._currentUuids.set(response.uuids ?? []);
      this._totalCount.set(response.totalCount ?? 0);
    } catch (error) {
      console.error('[IdentityUsersTableComponent] Nie udało się pobrać listy użytkowników.', error);
      this._currentUuids.set([]);
      this._totalCount.set(0);
    } finally {
      this._loading.set(false);
      this.loadingChange.emit(false);
    }
  }
}
