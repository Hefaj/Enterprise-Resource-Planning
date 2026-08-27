import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import {
  ErpSelectionMode,
  ErpSelectionState,
  ErpTableBuilder,
  ErpTableComponent,
  ErpTableConfig,
  ErpTableState,
} from '@erp/shared/ui';
import {
  IssueVM,
  SearchIssueRequest,
  SortOption,
  TaskManagementIssueOrchestrator,
} from '@erp/task-management/data-access';
import { ISSUE_PRIORITY } from '@erp/task-management/util';
import { TASKMANAGEMENT_KEYS } from '@erp/task-management/ui';

import { ISSUE_KEYS } from '../../../translation';

/**
 * Smart tabela zgłoszeń — lista serwerowa wg [`smart-tables.md`](../../../../../../../../../docs/frontend/smart-tables.md).
 *
 * <p>Wiersz to zawsze `Issue`, w każdym zakresie — w odróżnieniu od listy dokumentów DMS, gdzie
 * klucz wiersza zmienia się z zakresem. Tutaj nie ma czynności, więc dedup nie ma czego zgubić
 * (`docs/frontend/task-management-pages.md` §2.1).</p>
 *
 * <p>Sortowanie jest włączone <b>wyłącznie</b> na kolumnach z whitelisty
 * `IssueQueries.ApplySorting`: klucz, tytuł, priorytet, termin, data modyfikacji. Kolumna stanu
 * sortowania nie ma, bo backend sortowałby po uuid stanu, czyli po niczym sensownym —
 * a klik w nagłówek nie może obiecywać kolejności, której serwer nie wykona.</p>
 */
@Component({
  selector: 'erp-task-management-issue-table',
  standalone: true,
  imports: [ErpTableComponent],
  template: `<erp-table class="block h-full w-full" [config]="tableConfig()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskManagementIssueTableComponent {
  private readonly _orchestrator = inject(TaskManagementIssueOrchestrator);
  private readonly _transloco = inject(TranslocoService);

  public readonly filters = input<SearchIssueRequest>({});
  public readonly stateKey = input<string>();
  public readonly selectionMode = input<ErpSelectionMode>('multi');

  public readonly loadingChange = output<boolean>();
  public readonly selectionChange = output<ErpSelectionState<IssueVM>>();
  public readonly sortsChange = output<SortOption[] | undefined>();
  public readonly rowActivated = output<IssueVM>();

  private readonly _tableComponent = viewChild(ErpTableComponent);

  public clearSelection(): void {
    this._tableComponent()?.clearSelection();
  }

  private readonly _currentUuids = signal<string[]>([]);
  private readonly _totalCount = signal<number>(0);
  private readonly _loading = signal<boolean>(false);

  private _lastTableState: ErpTableState | null = null;

  protected readonly items = computed<IssueVM[]>(() => {
    const viewModels = this._orchestrator.getViewModel()();

    return this._currentUuids()
      .map((uuid) => viewModels.get(uuid))
      .filter((vm): vm is IssueVM => vm !== undefined);
  });

  public constructor() {
    effect(() => {
      const currentFilters = this.filters();
      untracked(() => {
        // Pierwsze pobranie robi `setOnStateChange` — bez tego strażnika strzelałyby dwa
        // zapytania na wejście na stronę.
        if (this._lastTableState !== null) {
          void this._fetchData(currentFilters, this._lastTableState);
        }
      });
    });
  }

  protected readonly tableConfig = computed<ErpTableConfig<IssueVM>>(() => {
    const builder = new ErpTableBuilder<IssueVM>()
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
      .setEmptyMessage(ISSUE_KEYS.table.emptyMessage)
      .setOnSelectionChange((state: ErpSelectionState<IssueVM>) => this.selectionChange.emit(state))
      .setOnRowDoubleClick((row: IssueVM) => this.rowActivated.emit(row))

      .addColumn((c) =>
        c.setId('key').setAccessorKey('key').setHeader(ISSUE_KEYS.table.columns.key).setSize(120).setGrow(0),
      )
      .addColumn((c) => c.setId('title').setAccessorKey('title').setHeader(ISSUE_KEYS.table.columns.title).setSize(360))
      .addColumn((c) =>
        c
          .setId('state')
          .setAccessorFn((row) => (row.stateNameKey ? this._transloco.translate(row.stateNameKey) : row.stateCode))
          .setHeader(ISSUE_KEYS.table.columns.state)
          .setEnableSorting(false)
          .setSize(150)
          .setGrow(0),
      )
      .addColumn((c) =>
        c
          .setId('priority')
          .setAccessorFn((row) => this._priorityLabel(row.priority))
          .setHeader(ISSUE_KEYS.table.columns.priority)
          .setSize(130)
          .setGrow(0),
      )
      .addColumn((c) =>
        c
          .setId('assignee')
          .setAccessorFn((row) => row.assigneeUuid ?? this._transloco.translate(ISSUE_KEYS.table.unassigned))
          .setHeader(ISSUE_KEYS.table.columns.assignee)
          .setEnableSorting(false)
          .setSize(220),
      )
      .addColumn((c) =>
        c.setId('dueAt').setAccessorKey('dueAt').setHeader(ISSUE_KEYS.table.columns.dueAt).setSize(140).setGrow(0),
      )
      .addColumn((c) =>
        c
          .setId('updatedAt')
          .setAccessorKey('updatedAt')
          .setHeader(ISSUE_KEYS.table.columns.updatedAt)
          .setSize(160)
          .setGrow(0),
      )

      .setOnStateChange((state) => {
        // Fetch tylko przy zmianie faktycznego zbioru danych — resize/reorder kolumn idą tym
        // samym callbackiem i nie mogą strzelać zapytaniem.
        const sortingChanged =
          !this._lastTableState || JSON.stringify(this._lastTableState.sorting) !== JSON.stringify(state.sorting);
        const dataStateChanged =
          !this._lastTableState ||
          JSON.stringify(this._lastTableState.pagination) !== JSON.stringify(state.pagination) ||
          sortingChanged;

        this._lastTableState = state;

        if (sortingChanged) {
          this.sortsChange.emit(this._toSorts(state));
        }

        if (dataStateChanged) {
          void this._fetchData(this.filters(), state);
        }
      });

    return builder.build();
  });

  private _priorityLabel(priority: number | undefined): string {
    switch (priority) {
      case ISSUE_PRIORITY.Critical:
        return this._transloco.translate(TASKMANAGEMENT_KEYS.priority.critical);
      case ISSUE_PRIORITY.High:
        return this._transloco.translate(TASKMANAGEMENT_KEYS.priority.high);
      case ISSUE_PRIORITY.Low:
        return this._transloco.translate(TASKMANAGEMENT_KEYS.priority.low);
      case ISSUE_PRIORITY.Lowest:
        return this._transloco.translate(TASKMANAGEMENT_KEYS.priority.lowest);
      default:
        return this._transloco.translate(TASKMANAGEMENT_KEYS.priority.normal);
    }
  }

  private _toSorts(tableState: ErpTableState | null): SortOption[] | undefined {
    if (!tableState?.sorting?.length) {
      return undefined;
    }

    return tableState.sorting.map((sort) => ({
      field: sort.columnId,
      order: sort.direction === 'asc' ? 1 : -1,
    }));
  }

  private async _fetchData(filters: SearchIssueRequest, tableState: ErpTableState | null): Promise<void> {
    this._loading.set(true);
    this.loadingChange.emit(true);

    try {
      const request: SearchIssueRequest = {
        ...filters,
        page: (tableState?.pagination?.pageIndex ?? 0) + 1,
        pageSize: tableState?.pagination?.pageSize ?? 20,
      };

      const sorts = this._toSorts(tableState);
      if (sorts) {
        request.sorts = sorts;
      }

      // `loadOptions: {}` wystarczy, żeby orkiestrator dociągnął projekty wyszukanych zgłoszeń.
      const response = await this._orchestrator.searchAsync(request, { autoLoad: true, loadOptions: {} });

      this._currentUuids.set(response.uuids ?? []);
      this._totalCount.set(response.totalCount ?? 0);
    } catch (error) {
      console.error('[TaskManagementIssueTableComponent] Nie udało się pobrać listy zgłoszeń.', error);
      this._currentUuids.set([]);
      this._totalCount.set(0);
    } finally {
      this._loading.set(false);
      this.loadingChange.emit(false);
    }
  }
}
