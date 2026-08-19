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
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { ErpTableComponent, ErpTableBuilder, ErpTableState, ErpTableConfig, ErpSelectionState } from '@erp/shared/ui';
import { UserOrchestrator, UserVM, SearchUserAccountRequest, SortOption } from '@erp/identity/data-access';

import { IDENTITY_KEYS } from '../../translation';

/** Tabela listy użytkowników — wybór pojedynczego wiersza (radio, `selectionMode: 'single'`),
 * nie klik w wiersz. Konsument dostaje uuid wybranego użytkownika (albo `null` przy odznaczeniu)
 * przez `selectionChange`. */
@Component({
  selector: 'erp-identity-users-table',
  standalone: true,
  imports: [CommonModule, ErpTableComponent],
  template: `<erp-table class="block h-full w-full" [config]="tableConfig()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdentityUsersTableComponent {
  private readonly _orchestrator = inject(UserOrchestrator);

  public filters = input<SearchUserAccountRequest>({});
  public stateKey = input<string>();

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
      .setSelectionMode('single')
      .setItems(this.items)
      .setItemCount(this._totalCount)
      .setLoading(this._loading)
      .setEmptyMessage(IDENTITY_KEYS.users.table.emptyMessage)
      .setOnSelectionChange((state: ErpSelectionState<UserVM>) => this.selectionChange.emit(state.selectedIds[0] ?? null))

      .addColumn((c) =>
        c
          .setId('email')
          .setAccessorKey('email')
          .setHeader(IDENTITY_KEYS.users.table.columns.email)
          .setSize(280),
      )
      .addColumn((c) =>
        c
          .setId('displayName')
          .setAccessorKey('displayName')
          .setHeader(IDENTITY_KEYS.users.table.columns.displayName)
          .setSize(220),
      )
      .addColumn((c) =>
        c
          .setId('isActive')
          .setAccessorKey('isActive')
          .setHeader(IDENTITY_KEYS.users.table.columns.isActive)
          .setEnableSorting(false)
          .setSize(120)
          .setCellFormatter((value: boolean) => (value ? '✓' : '—')),
      )
      .addColumn((c) =>
        c
          .setId('roleCount')
          .setAccessorFn((row) => row.roleGrants?.length ?? 0)
          .setHeader(IDENTITY_KEYS.users.table.columns.roleCount)
          .setEnableSorting(false)
          .setSize(120),
      )

      .setOnStateChange((state) => {
        this._lastTableState = state;
        this._fetchData(this.filters(), state);
      });

    return builder.build();
  });

  private _toSorts(tableState: ErpTableState | null): SortOption[] | undefined {
    if (!tableState?.sorting || tableState.sorting.length === 0) return undefined;
    return tableState.sorting.map((sort) => ({ field: sort.columnId, order: sort.direction === 'asc' ? 1 : -1 }));
  }

  private async _fetchData(filters: SearchUserAccountRequest, tableState: ErpTableState | null): Promise<void> {
    this._loading.set(true);
    this.loadingChange.emit(true);
    try {
      const request: SearchUserAccountRequest = {
        ...filters,
        page: (tableState?.pagination?.pageIndex ?? 0) + 1,
        pageSize: tableState?.pagination?.pageSize ?? 20,
      };

      const sorts = this._toSorts(tableState);
      if (sorts) {
        request.sorts = sorts;
      }

      // `loadOptions: {}` — nawet pusty obiekt wystarczy, żeby orkiestrator wywołał
      // `resolveEagerDependencies` i dociągnął role przypisane wyszukanym użytkownikom.
      const response = await this._orchestrator.searchAsync(request, { autoLoad: true, loadOptions: {} });

      this._currentUuids.set(response.uuids ?? []);
      this._totalCount.set(response.totalCount ?? 0);
    } catch (error) {
      console.error('[IdentityUsersTableComponent] Nie udało się pobrać listy użytkowników.', error);
    } finally {
      this._loading.set(false);
      this.loadingChange.emit(false);
    }
  }
}
