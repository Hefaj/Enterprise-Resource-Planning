import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ErpTableComponent, ErpTableBuilder, ErpTableState, ErpTableConfig } from '@erp/shared/ui';

import { GrantAuditOrchestrator, GrantAuditVM, SearchGrantAuditRequest, SortOption } from '@erp/identity/data-access';

import { GRANTAUDIT_KEYS } from '../../translation';

@Component({
  selector: 'erp-identity-grant-audit-table',
  standalone: true,
  imports: [CommonModule, ErpTableComponent],
  template: `
    <erp-table
      class="block h-full w-full"
      [config]="tableConfig()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdentityGrantAuditTableComponent {
  private readonly _orchestrator = inject(GrantAuditOrchestrator);

  /** Filtry przekazywane z zewnątrz (strona) */
  public filters = input<SearchGrantAuditRequest>({});

  public stateKey = input<string>();

  /** Zdarzenie emitowane podczas rozpoczęcia i zakończenia pobierania danych */
  public loadingChange = output<boolean>();

  private readonly _currentUuids = signal<string[]>([]);
  private readonly _totalCount = signal<number>(0);
  private readonly _loading = signal<boolean>(false);

  private _lastTableState: ErpTableState | null = null;

  protected readonly items = computed<GrantAuditVM[]>(() => {
    const uuids = this._currentUuids();
    const vmMap = this._orchestrator.getViewModel()();

    return uuids.map((uuid) => vmMap.get(uuid)).filter((vm): vm is GrantAuditVM => vm !== undefined);
  });

  public constructor() {
    effect(() => {
      const currentFilters = this.filters();

      untracked(() => {
        // Nie pobieraj przy pierwszej inicjalizacji, zanim tabela nie wyemituje swojego
        // początkowego stanu — pobraniem danych przy pierwszym wejściu zajmuje się builder.
        if (this._lastTableState !== null) {
          this._fetchData(currentFilters, this._lastTableState);
        }
      });
    });
  }

  protected readonly tableConfig = computed<ErpTableConfig<GrantAuditVM>>(() => {
    const builder = new ErpTableBuilder<GrantAuditVM>()
      .setMode('server')
      .setRowIdAccessor((x) => x.uuid)
      .setFilters(this.filters)
      .setStateKey(this.stateKey())
      .setEnableVirtualScroll(true)
      .setEstimatedRowHeight(44)
      .setDefaultPageSize(20)
      .setPageSizeOptions([10, 20, 50, 100])
      .setSelectionMode('none')
      .setItems(this.items)
      .setItemCount(this._totalCount)
      .setLoading(this._loading)
      .setEmptyMessage(GRANTAUDIT_KEYS.table.emptyMessage)

      .addColumn((c) =>
        c
          .setId('occurredAt')
          .setAccessorKey('occurredAt')
          .setHeader(GRANTAUDIT_KEYS.table.columns.occurredAt)
          .setSize(180)
          .setCellFormatter((value: Date) => (value ? new Date(value).toLocaleString() : '—')),
      )
      .addColumn((c) => c.setId('actorUserUuid').setAccessorKey('actorUserUuid').setHeader(GRANTAUDIT_KEYS.table.columns.actor).setSize(260))
      .addColumn((c) =>
        c
          .setId('subject')
          .setAccessorKey('subjectUuid')
          .setHeader(GRANTAUDIT_KEYS.table.columns.subject)
          .setEnableSorting(false)
          .setSize(280)
          .setCellRichContent((value: string, row: GrantAuditVM) => ({
            lines: [{ text: `${row.subjectType}: ${value}` }],
          })),
      )
      .addColumn((c) => c.setId('action').setAccessorKey('action').setHeader(GRANTAUDIT_KEYS.table.columns.action).setSize(160))
      .addColumn((c) => c.setId('targetCode').setAccessorKey('targetCode').setHeader(GRANTAUDIT_KEYS.table.columns.target).setSize(220))
      .addColumn((c) => c.setId('source').setAccessorKey('source').setHeader(GRANTAUDIT_KEYS.table.columns.source).setSize(140))

      .setOnStateChange((state) => {
        this._lastTableState = state;
        this._fetchData(this.filters(), state);
      });

    return builder.build();
  });

  private _toSorts(tableState: ErpTableState | null): SortOption[] | undefined {
    if (!tableState?.sorting || tableState.sorting.length === 0) return undefined;

    return tableState.sorting.map((sort) => ({
      field: sort.columnId,
      order: sort.direction === 'asc' ? 1 : -1,
    }));
  }

  private async _fetchData(filters: SearchGrantAuditRequest, tableState: ErpTableState | null): Promise<void> {
    this._loading.set(true);
    this.loadingChange.emit(true);
    try {
      const request: SearchGrantAuditRequest = {
        ...filters,
        page: (tableState?.pagination?.pageIndex ?? 0) + 1,
        pageSize: tableState?.pagination?.pageSize ?? 20,
      };

      const sorts = this._toSorts(tableState);
      if (sorts) {
        request.sorts = sorts;
      }

      const response = await this._orchestrator.searchAsync(request, { autoLoad: true });

      this._currentUuids.set(response.uuids ?? []);
      this._totalCount.set(response.totalCount ?? 0);
    } catch (error) {
      console.error('[IdentityGrantAuditTableComponent] Nie udało się pobrać wpisów audytu.', error);
    } finally {
      this._loading.set(false);
      this.loadingChange.emit(false);
    }
  }
}
