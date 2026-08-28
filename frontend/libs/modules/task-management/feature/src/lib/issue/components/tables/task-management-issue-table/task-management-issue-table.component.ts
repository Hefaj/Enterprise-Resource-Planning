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
import { formatDate } from '@angular/common';
import { TranslocoService } from '@jsverse/transloco';

import { UserDirectoryService } from '@erp/shared/data-access';
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
  ProjectFieldDto,
  ProjectFieldProfileService,
  SearchIssueRequest,
  SortOption,
  TaskManagementIssueOrchestrator,
} from '@erp/task-management/data-access';
import { CUSTOM_FIELD_DATA_TYPE, ISSUE_PRIORITY } from '@erp/task-management/util';
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
  private readonly _fields = inject(ProjectFieldProfileService);
  private readonly _users = inject(UserDirectoryService);

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

  /**
   * Kolumny projekto-specyficzne — <b>wyłącznie przy zawężeniu do jednego projektu</b>.
   * Bez projektu kod pola nie znaczy nic, bo dwa schematy mogą mapować ten sam kod na różne
   * kolumny (`docs/frontend/task-management-pages.md` §2.1).
   */
  protected readonly customFields = computed<ProjectFieldDto[]>(() =>
    this._fields.fieldsOf(this.filters().projectUuid)(),
  );

  public constructor() {
    // Profil pól jedzie za kontekstem projektu. Definicje kolumn NIE mogą być stałą
    // w komponencie: backend czyta whitelistę sortowania z tego samego profilu, więc stała
    // rozjechałaby się z nim przy pierwszym dodanym polu (`task-management.md` §6).
    effect(() => {
      const projectUuid = this.filters().projectUuid;

      if (projectUuid) {
        untracked(() => void this._fields.loadAsync(projectUuid));
      }
    });

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
        c
          .setId('key')
          // W trybie drzewa klucz dostaje wcięcie wg poziomu zagnieżdżenia. Wcięcie, a nie
          // osobna kolumna „poziom": to klucz jest tym, po czym użytkownik wodzi wzrokiem,
          // szukając struktury, a pusta kolumna przy płaskiej liście byłaby kosztem bez zysku.
          .setAccessorFn((row) => `${'\u00a0\u00a0\u00a0'.repeat(this._level(row))}${row.key}`)
          .setHeader(ISSUE_KEYS.table.columns.key)
          .setSize(160)
          .setGrow(0),
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
          .setAccessorFn((row) => row.assignee?.displayName ?? this._transloco.translate(ISSUE_KEYS.table.unassigned))
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

    // Kolumny projekto-specyficzne dokładamy po wspólnych — pętlą, a nie w łańcuchu, bo ich
    // liczba i kształt są daną z profilu, nie stałą w komponencie (`task-management.md` §6).
    for (const field of this.customFields()) {
      builder.addColumn((c) => {
        c
          // Identyfikatorem kolumny jest KOD POLA — to on wraca w `sort.field` i po nim backend
          // odnajduje slot. Własny identyfikator zerwałby to powiązanie.
          .setId(field.code)
          .setAccessorFn((row: IssueVM) => this._customFieldLabel(row, field))
          .setHeader(field.nameKey)
          // Sortowanie tylko na polach ze slotem: klik w nagłówek nie może obiecywać
          // kolejności, której serwer nie wykona.
          .setEnableSorting(field.isSortable)
          .setSize(160);
      });
    }

    return builder.build();
  });

  /**
   * Wartość pola niestandardowego w postaci do pokazania.
   *
   * <p>Po drucie wszystko jest tekstem w postaci kanonicznej (liczba z kropką, data ISO-8601
   * UTC, użytkownik jako uuid) — formatowanie jest wyłącznie sprawą widoku. Użytkownik pokazuje
   * się nazwiskiem ze wspólnego katalogu, nigdy uuidem (`docs/frontend/user-directory.md`);
   * dopóki nazwisko nie dojedzie, zostaje uuid, a nie pustka.</p>
   */
  private _customFieldLabel(row: IssueVM, field: ProjectFieldDto): string {
    const value = row.customFields?.[field.code];

    if (!value) {
      return '';
    }

    if (field.dataType === CUSTOM_FIELD_DATA_TYPE.User) {
      return this._users.getOne(value)()?.displayName ?? value;
    }

    if (field.dataType === CUSTOM_FIELD_DATA_TYPE.Date) {
      return formatDate(value, 'short', this._transloco.getActiveLang());
    }

    return value;
  }

  /**
   * Poziom zagnieżdżenia liczony <b>lokalnie</b>, z `parentUuid` wierszy będących na stronie.
   *
   * <p>Backend nie odsyła poziomu i nie musi: w trybie drzewa gwarantuje, że przodek każdego
   * zgłoszenia jest gdzieś na tej samej stronie, więc łańcuch da się odtworzyć bez dodatkowego
   * pola w kontrakcie. Poza trybem drzewa zawsze zero — płaska lista nie udaje struktury,
   * której nie pokazuje w całości.</p>
   */
  private _level(row: IssueVM): number {
    if (!this.filters().treeMode) {
      return 0;
    }

    const byUuid = new Map(this.items().map((item) => [item.uuid, item]));

    let level = 0;
    let current = row;

    // Ogranicznik na wypadek danych z pętlą — CTE po stronie serwera ma swój, ten jest
    // po to, żeby przeglądarka nie zawiesiła się na wierszu, którego backend nie odrzucił.
    while (current.parentUuid && level < 32) {
      const parent = byUuid.get(current.parentUuid);

      if (!parent) {
        break;
      }

      level++;
      current = parent;
    }

    return level;
  }

  /**
   * Poziom zagnieżdżenia wiersza liczony w obrębie ZAŁADOWANEJ strony.
   *
   * <p>Zgłoszenie, którego rodzica nie ma na stronie, jest korzeniem z punktu widzenia widoku —
   * i tak właśnie ma się rysować. Wchodzenie po rodzicach poza stronę oznaczałoby dociąganie
   * zgłoszeń tylko po to, żeby policzyć wcięcie.</p>
   */
  private _levelOf(row: IssueVM): number {
    const byUuid = new Map(this.items().map((item) => [item.uuid, item]));

    let level = 0;
    let parent = row.parentUuid ? byUuid.get(row.parentUuid) : undefined;

    // Ogranicznik głębokości nie jest ozdobnikiem: dane sprzed reguł cyklu (albo wpisane
    // ręcznie w bazie) mogą zawierać pętlę, a pętla w tej pętli zawiesiłaby renderowanie wiersza.
    while (parent && level < 16) {
      level++;
      parent = parent.parentUuid ? byUuid.get(parent.parentUuid) : undefined;
    }

    return level;
  }

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

  /**
   * Dociąga nazwiska z pól niestandardowych typu „użytkownik" — jedną paczką na całą stronę
   * listy, tak samo jak przypisany i zgłaszający w orkiestratorze.
   */
  private async _resolveCustomFieldUsersAsync(): Promise<void> {
    const userFields = this.customFields().filter((f) => f.dataType === CUSTOM_FIELD_DATA_TYPE.User);

    if (userFields.length === 0) {
      return;
    }

    const uuids = new Set<string>();

    for (const row of this.items()) {
      for (const field of userFields) {
        const value = row.customFields?.[field.code];

        if (value) {
          uuids.add(value);
        }
      }
    }

    if (uuids.size > 0) {
      await this._users.loadAsync([...uuids]);
    }
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

      await this._resolveCustomFieldUsersAsync();
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
