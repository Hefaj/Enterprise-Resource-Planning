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
} from '@angular/core';

import {
  ErpTableBuilder,
  ErpTableComponent,
  ErpTableConfig,
  ErpTableState,
} from '@erp/shared/ui';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, filter } from 'rxjs/operators';

import { SignalrSyncService } from '@erp/shared/data-access';
import {
  JobVM,
  NotificationJobOrchestrator,
  SearchJobRequest,
} from '@erp/notification/data-access';
import { JOB_ARRIVAL_DEBOUNCE_MS, NOTIFICATION_JOB_SIGNATURE } from '@erp/notification/util';
import { JOB_KEYS } from '@erp/notification/ui';

import { JobCommandCellComponent } from './job-command-cell.component';
import { JobStatusCellComponent } from './job-status-cell.component';

/**
 * Tabela zadań masowych — serwerowa paginacja i sortowanie na replice z modułu Notification.
 *
 * Identyfikatory kolumn nie są kosmetyką: jadą na backend jako `sorts[].field` i muszą
 * trafić w whitelistę `JobQueries.ApplySorting`. Kolumny liczone po stronie klienta
 * (postęp) mają sortowanie wyłączone, bo backend nie ma czego po nich uporządkować.
 */
@Component({
  selector: 'erp-notification-job-table',
  standalone: true,
  imports: [ErpTableComponent],
  template: `
    <erp-table
      class="block h-full w-full"
      [config]="tableConfig()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationJobTableComponent {
  private readonly _orchestrator = inject(NotificationJobOrchestrator);
  private readonly _signalrSync = inject(SignalrSyncService);

  /** Filtry przekazywane ze strony (panel filtrów + zakładka statusu). */
  public readonly filters = input<Partial<SearchJobRequest>>({});

  /** Klucz stanu tabeli (paginacja, sortowanie, układ kolumn). */
  public readonly stateKey = input<string>();

  /** Emitowane na starcie i końcu pobierania danych. */
  public readonly loadingChange = output<boolean>();

  private readonly _currentUuids = signal<string[]>([]);
  private readonly _totalCount = signal<number>(0);
  private readonly _loading = signal<boolean>(false);

  private readonly _viewModels = this._orchestrator.getViewModel();

  /** Ostatni stan tabeli — potrzebny, żeby zmiana filtrów nie gubiła paginacji i sortowania. */
  private _lastTableState: ErpTableState | null = null;

  protected readonly items = computed<JobVM[]>(() => {
    const viewModels = this._viewModels();

    return this._currentUuids()
      .map(uuid => viewModels.get(uuid))
      .filter((vm): vm is JobVM => vm !== undefined);
  });

  public constructor() {
    effect(() => {
      const currentFilters = this.filters();

      // Pierwsze pobranie odpala `setOnStateChange` tabeli — tutaj tylko reagujemy na
      // późniejsze zmiany filtrów, żeby nie wystrzelić dwóch zapytań przy wejściu na widok.
      untracked(() => {
        if (this._lastTableState !== null) {
          void this._fetchData(currentFilters, this._lastTableState);
        }
      });
    });

    // Zadania widoczne na stronie odświeża sam orkiestrator (są w jego cache), ale NOWE
    // z definicji w nim nie są — bez tego zadanie zlecone przy otwartej historii pojawiłoby
    // się dopiero po ręcznym odświeżeniu. Debounce zbija serię zdarzeń (postęp kolejnych
    // chunków, ruch innych klientów) do jednego zapytania.
    this._signalrSync
      .onUpdate(NOTIFICATION_JOB_SIGNATURE)
      .pipe(
        filter(uuids => uuids.some(uuid => !this._currentUuids().includes(uuid))),
        debounceTime(JOB_ARRIVAL_DEBOUNCE_MS),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.reload());
  }

  /** Ponowne pobranie bieżącej strony — wołane z akcji „Odśwież" na pasku narzędzi. */
  public reload(): void {
    void this._fetchData(this.filters(), this._lastTableState);
  }

  protected readonly tableConfig = computed<ErpTableConfig<JobVM>>(() => {
    const builder = new ErpTableBuilder<JobVM>()
      .setMode('server')
      .setRowIdAccessor(job => job.trackingID)
      .setStateKey(this.stateKey())
      .setSelectionMode('none')
      .setEnableVirtualScroll(true)
      .setEstimatedRowHeight(52)
      .setDefaultPageSize(20)
      .setPageSizeOptions([10, 20, 50, 100])
      .setItems(this.items)
      .setItemCount(this._totalCount)
      .setLoading(this._loading)
      .setEmptyMessage(JOB_KEYS.history.empty)
      // Najnowsze zadania na górze — ten sam porządek, co domyślny na backendzie.
      .setInitialState({ sorting: [{ columnId: 'createdAt', direction: 'desc' }] })

      .addColumnGroup(g => g
        .setId('job')
        .setHeader(JOB_KEYS.page.table.groups.job)
        .addColumn(c => c
          .setId('commandType')
          .setHeader(JOB_KEYS.page.table.columns.command)
          .setCell(JobCommandCellComponent)
          .setSize(320)
        )
        .addColumn(c => c
          .setId('status')
          .setHeader(JOB_KEYS.page.table.columns.status)
          .setCell(JobStatusCellComponent)
          .setSize(200)
        )
        .addColumn(c => c
          .setId('createdAt')
          .setAccessorKey('createdAt')
          .setHeader(JOB_KEYS.page.table.columns.createdAt)
          .setSize(180)
          .setCellFormatter((value: Date | undefined) => value ? value.toLocaleString() : '—')
        )
      )

      .addColumnGroup(g => g
        .setId('progress')
        .setHeader(JOB_KEYS.page.table.groups.progress)
        .addColumn(c => c
          .setId('progress')
          .setHeader(JOB_KEYS.page.table.columns.progress)
          .setEnableSorting(false)
          .setAlign('right')
          .setSize(140)
          .setAccessorFn(job => job.totalCount)
          .setCellFormatter((_value: number, job: JobVM) =>
            job.totalCount > 0 ? `${job.succeededCount + job.failedCount} / ${job.totalCount}` : '—',
          )
        )
        .addColumn(c => c
          .setId('succeededCount')
          .setAccessorKey('succeededCount')
          .setHeader(JOB_KEYS.page.table.columns.succeeded)
          .setEnableSorting(false)
          .setAlign('right')
          .setSize(120)
        )
        .addColumn(c => c
          .setId('failedCount')
          .setAccessorKey('failedCount')
          .setHeader(JOB_KEYS.page.table.columns.failed)
          .setEnableSorting(false)
          .setAlign('right')
          .setSize(120)
        )
        .addColumn(c => c
          .setId('errorsSummary')
          .setAccessorKey('errorsSummary')
          .setHeader(JOB_KEYS.page.table.columns.errors)
          .setEnableSorting(false)
          .setSize(280)
          // Surowy tekst z backendu (`"price_negative: 1200"`), nie klucz tłumaczenia.
          .setCellFormatter((value: string | null | undefined) => value ?? '—')
        )
      );

    builder
      .setOnStateChange(state => {
        const dataStateChanged = !this._lastTableState
          || JSON.stringify(this._lastTableState.pagination) !== JSON.stringify(state.pagination)
          || JSON.stringify(this._lastTableState.sorting) !== JSON.stringify(state.sorting);

        this._lastTableState = state;

        if (dataStateChanged) {
          void this._fetchData(this.filters(), state);
        }
      });

    return builder.build();
  });

  private async _fetchData(
    filters: Partial<SearchJobRequest>,
    tableState: ErpTableState | null,
  ): Promise<void> {
    this._loading.set(true);
    this.loadingChange.emit(true);

    try {
      const request: SearchJobRequest = {
        ...filters,
        // `pageIndex` z ErpTable liczy się od zera, `page` w kontrakcie HTTP od jedynki.
        page: (tableState?.pagination?.pageIndex ?? 0) + 1,
        pageSize: tableState?.pagination?.pageSize ?? 20,
      };

      if (tableState?.sorting && tableState.sorting.length > 0) {
        request.sorts = tableState.sorting.map(sort => ({
          field: sort.columnId,
          order: sort.direction === 'asc' ? 1 : -1,
        }));
      }

      const response = await this._orchestrator.searchAsync(request, { autoLoad: true });

      this._currentUuids.set(response.uuids ?? []);
      this._totalCount.set(response.totalCount ?? 0);
    } catch (error) {
      // Błąd wylądował już w `errors` orkiestratora — tutaj zostaje pusta lista zamiast
      // wywrócenia widoku.
      console.error('[NotificationJobTableComponent] Error fetching data:', error);
      this._currentUuids.set([]);
      this._totalCount.set(0);
    } finally {
      this._loading.set(false);
      this.loadingChange.emit(false);
    }
  }
}
