import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, effect, untracked, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TranslocoService } from '@jsverse/transloco';

import { ErpTableComponent, ErpTableBuilder, ErpTableState, ErpTableConfig, ErpSelectionState, ErpSelectionMode } from '@erp/shared/ui';
import { UserOrchestrator, UserVM, SearchUserAccountRequest } from '@erp/identity/data-access';
import { USER_ACCOUNT_KIND } from '@erp/identity/util';

import { USERS_KEYS } from '../../../translation';

/** Tabela listy użytkowników — `selectionMode` input (domyślnie `'multi'`, checkboxy), bo strona
 * ma zarówno akcje masowe toolbara (patrz `docs/frontend/selection-scope.md`), jak i panel
 * szczegółów zależny od zaznaczenia dokładnie jednego wiersza (`UsersStore.selectedUuid`).
 * Konsument dostaje pełny `ErpSelectionState<UserVM>` przez `selectionChange` — to on, przez
 * `erpResolveSelectionScope`, rozstrzyga „lista czy filtr", nie ta tabela. `selectionMode` jest
 * inputem, nie wartością zaszytą na sztywno w builderze — patrz `docs/frontend/smart-tables.md`
 * §2 (anatomia smart tabeli) i `docs/frontend/pages.md` §10 (częste błędy). */
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
  private readonly _transloco = inject(TranslocoService);

  public filters = input<SearchUserAccountRequest>({});
  public stateKey = input<string>();
  public selectionMode = input<ErpSelectionMode>('multi');

  public loadingChange = output<boolean>();
  public selectionChange = output<ErpSelectionState<UserVM>>();

  private readonly _tableComponent = viewChild(ErpTableComponent);

  public clearSelection(): void {
    this._tableComponent()?.clearSelection();
  }

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
      .setOnSelectionChange((state: ErpSelectionState<UserVM>) => this.selectionChange.emit(state))

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
          .setGrow(0)
          .setCellFormatter((value: boolean) => (value ? '✓' : '—')),
      )
      .addColumn((c) =>
        c
          .setId('roleCount')
          .setAccessorFn((row) => row.roleGrants?.length ?? 0)
          .setHeader(USERS_KEYS.table.columns.roleCount)
          .setEnableSorting(false)
          .setSize(120)
          .setGrow(0),
      )
      // Widoczna zawsze — nawet z domyślnym filtrem `Kind = Human` warto móc odróżnić kolumnę
      // wizualnie, gdy admin ręcznie wyczyści filtr i zobaczy oba rodzaje na liście naraz.
      .addColumn((c) =>
        c
          .setId('kind')
          .setAccessorKey('kind')
          .setHeader(USERS_KEYS.table.columns.kind)
          .setEnableSorting(false)
          .setSize(140)
          .setGrow(0)
          .setCellFormatter((value: number) =>
            this._transloco.translate(
              value === USER_ACCOUNT_KIND.Service ? USERS_KEYS.table.kindService : USERS_KEYS.table.kindHuman,
            ),
          ),
      )
      .addColumn((c) =>
        c
          .setId('description')
          .setAccessorKey('description')
          .setHeader(USERS_KEYS.table.columns.description)
          .setEnableSorting(false)
          .setSize(240)
          .setCellFormatter((value: string | undefined) => value ?? '—'),
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
