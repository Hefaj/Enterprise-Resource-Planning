import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import { ErpTableBuilder, ErpTableComponent, ErpTableConfig, ErpTableState } from '@erp/shared/ui';
import {
  ProjectVM,
  SearchProjectRequest,
  TaskManagementFieldSchemeOrchestrator,
  TaskManagementProjectOrchestrator,
} from '@erp/task-management/data-access';
import { PROJECT_KIND } from '@erp/task-management/util';

import { PROJECT_KEYS } from '../../../translation';

/**
 * Smart tabela projektów — lista serwerowa wg [`smart-tables.md`](../../../../../../../../../docs/frontend/smart-tables.md).
 *
 * <p>Kolumna „schemat pól" pokazuje <b>nazwę schematu</b>, nie jego uuid, i jest tu celowo:
 * to jedyne miejsce, w którym widać na raz, które projekty mają własne pola, a które nie —
 * a od tego zaczyna się każda rozmowa o konfiguracji (`task-management-pages.md` §4.1).</p>
 */
@Component({
  selector: 'erp-task-management-project-table',
  standalone: true,
  imports: [ErpTableComponent],
  template: `<erp-table class="block h-full w-full" [config]="tableConfig()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskManagementProjectTableComponent {
  private readonly _orchestrator = inject(TaskManagementProjectOrchestrator);
  private readonly _schemes = inject(TaskManagementFieldSchemeOrchestrator);
  private readonly _transloco = inject(TranslocoService);

  public readonly filters = input<SearchProjectRequest>({});

  public readonly loadingChange = output<boolean>();
  public readonly rowActivated = output<ProjectVM>();

  private readonly _currentUuids = signal<string[]>([]);
  private readonly _totalCount = signal<number>(0);
  private readonly _loading = signal<boolean>(false);

  private _lastTableState: ErpTableState | null = null;

  protected readonly items = computed<ProjectVM[]>(() => {
    const viewModels = this._orchestrator.getViewModel()();

    return this._currentUuids()
      .map((uuid) => viewModels.get(uuid))
      .filter((vm): vm is ProjectVM => vm !== undefined);
  });

  public constructor() {
    effect(() => {
      const currentFilters = this.filters();
      untracked(() => {
        if (this._lastTableState !== null) {
          void this._fetchData(currentFilters, this._lastTableState);
        }
      });
    });
  }

  protected readonly tableConfig = computed<ErpTableConfig<ProjectVM>>(() =>
    new ErpTableBuilder<ProjectVM>()
      .setMode('server')
      .setRowIdAccessor((x) => x.uuid)
      .setFilters(this.filters)
      .setStateKey('taskmgmt-project-list')
      .setDefaultPageSize(20)
      .setPageSizeOptions([10, 20, 50])
      .setSelectionMode('none')
      .setItems(this.items)
      .setItemCount(this._totalCount)
      .setLoading(this._loading)
      .setEmptyMessage(PROJECT_KEYS.table.emptyMessage)
      .setOnRowDoubleClick((row: ProjectVM) => this.rowActivated.emit(row))
      .addColumn((c) =>
        c.setId('code').setAccessorKey('code').setHeader(PROJECT_KEYS.table.columns.code).setSize(100).setGrow(0),
      )
      .addColumn((c) => c.setId('name').setAccessorKey('name').setHeader(PROJECT_KEYS.table.columns.name).setSize(320))
      .addColumn((c) =>
        c
          .setId('kind')
          .setAccessorFn((row) =>
            this._transloco.translate(
              row.kind === PROJECT_KIND.Intake ? PROJECT_KEYS.filters.kind.intake : PROJECT_KEYS.filters.kind.delivery,
            ),
          )
          .setHeader(PROJECT_KEYS.table.columns.kind)
          .setEnableSorting(false)
          .setSize(160)
          .setGrow(0),
      )
      .addColumn((c) =>
        c
          .setId('openIssueCount')
          .setAccessorKey('openIssueCount')
          .setHeader(PROJECT_KEYS.table.columns.openIssues)
          .setEnableSorting(false)
          .setSize(110)
          .setGrow(0),
      )
      .addColumn((c) =>
        c
          .setId('members')
          .setAccessorFn((row) => String(row.members?.length ?? 0))
          .setHeader(PROJECT_KEYS.table.columns.members)
          .setEnableSorting(false)
          .setSize(130)
          .setGrow(0),
      )
      .addColumn((c) =>
        c
          .setId('fieldScheme')
          .setAccessorFn((row) => this._schemeName(row))
          .setHeader(PROJECT_KEYS.table.columns.fieldScheme)
          .setEnableSorting(false)
          .setSize(220),
      )
      .setOnStateChange((state) => {
        const dataStateChanged =
          !this._lastTableState ||
          JSON.stringify(this._lastTableState.pagination) !== JSON.stringify(state.pagination);

        this._lastTableState = state;

        if (dataStateChanged) {
          void this._fetchData(this.filters(), state);
        }
      })
      .build(),
  );

  /** Nazwa schematu z sąsiedniego orkiestratora; dopóki nie dojedzie — myślnik, nigdy uuid. */
  private _schemeName(row: ProjectVM): string {
    if (!row.fieldSchemeUuid) {
      return this._transloco.translate(PROJECT_KEYS.table.noScheme);
    }

    return this._schemes.getOne(row.fieldSchemeUuid)()?.name ?? this._transloco.translate(PROJECT_KEYS.table.noScheme);
  }

  private async _fetchData(filters: SearchProjectRequest, tableState: ErpTableState | null): Promise<void> {
    this._loading.set(true);
    this.loadingChange.emit(true);

    try {
      // Schematy pól PRZED projektami: nazwa schematu wchodzi do komórki przez akcesor, a ten
      // liczy się w chwili renderu wiersza. Dociągnięcie ich po ustawieniu listy zostawiałoby
      // w kolumnie myślnik do następnego przerysowania tabeli.
      await this._schemes.searchAsync({}, { autoLoad: true });

      const response = await this._orchestrator.searchAsync(
        {
          ...filters,
          page: (tableState?.pagination?.pageIndex ?? 0) + 1,
          pageSize: tableState?.pagination?.pageSize ?? 20,
        },
        { autoLoad: true },
      );

      this._currentUuids.set(response.uuids ?? []);
      this._totalCount.set(response.totalCount ?? 0);
    } catch (error) {
      console.error('[TaskManagementProjectTableComponent] Nie udało się pobrać listy projektów.', error);
      this._currentUuids.set([]);
      this._totalCount.set(0);
    } finally {
      this._loading.set(false);
      this.loadingChange.emit(false);
    }
  }
}
