import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslocoService } from '@jsverse/transloco';
import { TuiDay } from '@taiga-ui/cdk';

import {
  ErpButtonBuilder,
  ErpButtonComponent,
  ErpDatePickerBuilder,
  ErpDatePickerComponent,
  ErpEmptyStateComponent,
  ErpInputPickerBuilder,
  ErpInputPickerComponent,
  ErpInputPickerConfig,
  ErpTableBuilder,
  ErpTableComponent,
  ErpTableConfig,
  ErpTranslatePipe,
  injectTranslationsReadySignal,
} from '@erp/shared/ui';
import { ERP_USER_DIRECTORY } from '@erp/shared/util';
import { ErpReportPivotLabelCellComponent, ErpReportPivotRow } from '@erp/task-management/ui';

import { REPORT_KEYS, provideReportTranslations } from '../translation';
import { REPORT_DEFINITIONS, ReportStore } from './report.store';
import { ReportPivotData, ReportRowsData } from './report-pivot';

/** Wiersz generycznej tabeli CSV, opakowany indeksem — potrzebny jako stabilny `rowIdAccessor`,
 * bo same wartości `readonly string[]` mogą się powtórzyć między wierszami. */
interface ReportRow {
  readonly index: number;
  readonly values: readonly string[];
}

/** Nagłówki CSV, których wartość jest wyłącznie identyfikatorem powtórzonym obok czytelnej
 * kolumny (`type_uuid` obok `type_name`, `sprint_uuid` obok `sprint_name`) — generyczna tabela
 * ich nie pokazuje, to samo co pivot robi milcząco dla `zagadnienie_uuid`. */
const HIDDEN_COLUMNS = new Set(['type_uuid', 'sprint_uuid']);

/** `erp-datepicker` operuje na `TuiDay`, a `ReportStore.dateFrom`/`dateTo` na ISO `YYYY-MM-DD`
 * (format oczekiwany przez parametry raportu wysyłane do backendu). */
function tuiDayToIso(day: TuiDay | null): string {
  if (!day) {
    return '';
  }
  const month = String(day.month + 1).padStart(2, '0');
  const dayOfMonth = String(day.day).padStart(2, '0');
  return `${day.year}-${month}-${dayOfMonth}`;
}

/** Nagłówek CSV → klucz tłumaczenia etykiety kolumny (`REPORT_KEYS.columns`). Kolumna spoza tej
 * mapy pokazuje swój surowy nagłówek — bezpieczny fallback, gdyby backend dołożył pole, o którym
 * front jeszcze nie wie. */
const COLUMN_LABEL_KEYS: Record<string, string> = {
  project_code: REPORT_KEYS.columns.projectCode,
  state_code: REPORT_KEYS.columns.stateCode,
  type_name: REPORT_KEYS.columns.typeName,
  assignee_uuid: REPORT_KEYS.columns.assigneeUuid,
  count: REPORT_KEYS.columns.count,
  state_category: REPORT_KEYS.columns.stateCategory,
  period: REPORT_KEYS.columns.period,
  avg_hours: REPORT_KEYS.columns.avgHours,
  median_hours: REPORT_KEYS.columns.medianHours,
  sample_count: REPORT_KEYS.columns.sampleCount,
  total_count: REPORT_KEYS.columns.totalCount,
  within_response_sla_count: REPORT_KEYS.columns.withinResponseSlaCount,
  within_resolution_sla_count: REPORT_KEYS.columns.withinResolutionSlaCount,
  sprint_name: REPORT_KEYS.columns.sprintName,
  done_count: REPORT_KEYS.columns.doneCount,
  estimate_minutes_total: REPORT_KEYS.columns.estimateMinutesTotal,
  logged_minutes_total: REPORT_KEYS.columns.loggedMinutesTotal,
  card_count: REPORT_KEYS.columns.cardCount,
  date: REPORT_KEYS.columns.date,
  remaining_count: REPORT_KEYS.columns.remainingCount,
  remaining_estimate_minutes: REPORT_KEYS.columns.remainingEstimateMinutes,
};

/**
 * Strona `/task-management/report` — pięć definicji raportu Task Management (RPT-002 `Must`,
 * RPT-003 `Should`, faza 7).
 *
 * <p><b>Świadomie łamie wzorzec `erp-grid-layout` + filtr + tabela</b> (jak `BoardComponent` —
 * patrz komentarz tam): to nie lista agregatu z filtrami po boku, tylko formularz parametrów
 * nad wynikiem, który po wygenerowaniu zajmuje resztę strony jako tabela.</p>
 *
 * <p><b>Rozwinięcie wiersza działu (hours-by-department) kończy się na zagadnieniu</b>, a
 * generyczna tabela pozostałych czterech definicji nie ma żadnej kolumny tytułu/opisu/klucza
 * zgłoszenia — CSV z backendu jej po prostu nie niesie (PERM-005 AC2), więc nie ma tu ryzyka
 * wycieku do listy zgłoszeń, do której czytelnik raportu (kierownictwo) może nie mieć dostępu.</p>
 */
@Component({
  selector: 'erp-task-management-report',
  standalone: true,
  imports: [
    ErpButtonComponent,
    ErpDatePickerComponent,
    ErpEmptyStateComponent,
    ErpInputPickerComponent,
    ErpTableComponent,
    ErpTranslatePipe,
    ReactiveFormsModule,
  ],
  providers: [ReportStore, provideReportTranslations()],
  template: `
    <div class="flex h-full min-h-0 w-full flex-col gap-4 p-4">
      <div class="flex flex-wrap items-end gap-3">
        <erp-input-picker class="min-w-64" [config]="this.reportPickerConfig()" [control]="this.reportControl" />

        @if (this.store.currentDefinition().needsDateRange) {
          <erp-datepicker class="min-w-40" [config]="dateFromPickerConfig()" [control]="dateFromControl" />
          <erp-datepicker class="min-w-40" [config]="dateToPickerConfig()" [control]="dateToControl" />
        }

        @if (this.store.currentDefinition().needsProjects) {
          <erp-input-picker
            class="min-w-64"
            [config]="departmentPickerConfig()"
            [control]="departmentControl"
          />
        }

        <erp-button [config]="generateButtonConfig()" />

        @if (this.store.canDownloadCsv()) {
          <erp-button [config]="downloadButtonConfig()" />
        }
      </div>

      @if (!this.store.isDateRangeValid() && (this.store.dateFrom() || this.store.dateTo())) {
        <p class="m-0 text-sm text-[var(--tui-status-negative)]">
          {{ REPORT_KEYS.params.invalidRange | erpTranslate }}
        </p>
      }

      @if (this.store.errorMessage()) {
        <p class="m-0 text-sm text-[var(--tui-status-negative)]">{{ this.store.errorMessage() }}</p>
      }

      <div class="min-h-0 flex-1 overflow-auto">
        @if (this.store.isGenerating() || this.store.isFetchingArtifact()) {
          <erp-empty-state
            [config]="{
              icon: '@tui.loader',
              message: this.store.isGenerating() ? REPORT_KEYS.status.generating : REPORT_KEYS.status.fetchingArtifact,
            }"
          />
          @if (this.store.isGenerating()) {
            <div class="flex justify-center">
              <erp-button [config]="refreshButtonConfig()" />
            </div>
          }
        } @else if (this.store.currentDefinition().hasPivot) {
          @if (!this.store.pivot()) {
            <erp-empty-state [config]="{ icon: '@tui.chart-bar', message: REPORT_KEYS.empty }" />
          } @else if (this.store.pivot()!.departments.length === 0) {
            <erp-empty-state [config]="{ icon: '@tui.inbox', message: REPORT_KEYS.noData }" />
          } @else {
            <erp-table class="block h-full w-full" [config]="this.pivotTableConfig(this.store.pivot()!)" />
          }
        } @else {
          @if (!this.store.rows()) {
            <erp-empty-state [config]="{ icon: '@tui.chart-bar', message: REPORT_KEYS.empty }" />
          } @else if (this.store.rows()!.rows.length === 0) {
            <erp-empty-state [config]="{ icon: '@tui.inbox', message: REPORT_KEYS.noData }" />
          } @else {
            <erp-table class="block h-full w-full" [config]="this.rowsTableConfig(this.store.rows()!)" />
          }
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        flex: 1;
        height: 100%;
        min-height: 0;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportComponent {
  protected readonly REPORT_KEYS = REPORT_KEYS;

  protected readonly store = inject(ReportStore);

  private readonly _transloco = inject(TranslocoService);
  private readonly _directory = inject(ERP_USER_DIRECTORY, { optional: true });
  private readonly _translationsReady = injectTranslationsReadySignal();

  protected readonly reportControl = new FormControl<string>(REPORT_DEFINITIONS[0].key, { nonNullable: true });
  protected readonly departmentControl = new FormControl<string[]>([]);
  protected readonly dateFromControl = new FormControl<TuiDay | null>(null);
  protected readonly dateToControl = new FormControl<TuiDay | null>(null);

  protected readonly reportPickerConfig: ReturnType<typeof computed<ErpInputPickerConfig>>;
  protected readonly departmentPickerConfig: ReturnType<typeof computed<ErpInputPickerConfig>>;
  protected readonly dateFromPickerConfig;
  protected readonly dateToPickerConfig;
  protected readonly generateButtonConfig;
  protected readonly refreshButtonConfig;
  protected readonly downloadButtonConfig;

  /** Kody grup (działów) rozwiniętych w spłaszczonej tabeli przestawnej. */
  private readonly _expandedGroups = signal<ReadonlySet<string>>(new Set());

  public constructor() {
    this.reportPickerConfig = computed(() => {
      // Strażnik reaktywności Transloco — `computed` cache'uje wynik na zawsze, jeśli odczyta
      // `translate(...)` zanim scope się doładuje (patrz docs/guides/frontend/translations.md);
      // `_translationsReady()` jest
      // sygnałem, więc samo jego odczytanie tutaj wymusza ponowne przeliczenie po doładowaniu.
      this._translationsReady();

      return ErpInputPickerBuilder.create((b) =>
        b
          .setLabel(REPORT_KEYS.params.reportKey.label)
          .setItems(REPORT_DEFINITIONS.map((def) => ({ key: def.key, label: this._transloco.translate(def.label) })))
          .setLabelKey('label')
          .setValueKey('key')
          .setStrategy('single'),
      );
    });

    this.reportControl.valueChanges.subscribe((value) => this.store.selectReport(value));

    this.departmentPickerConfig = computed(() =>
      ErpInputPickerBuilder.create((b) =>
        b
          .setLabel(REPORT_KEYS.params.departments.label)
          .setItems(
            this.store.departments().map((project) => ({
              uuid: project.uuid,
              label: `${project.code} — ${project.name}`,
            })),
          )
          .setLabelKey('label')
          .setValueKey('uuid')
          .setStrategy('multi'),
      ),
    );

    this.departmentControl.valueChanges.subscribe((value) => {
      this.store.departmentUuids.set(value ?? []);
    });

    this.dateFromPickerConfig = computed(() =>
      ErpDatePickerBuilder.create((b) =>
        b.setLabel(REPORT_KEYS.params.dateFrom.label).setStrategy('single').setMode('date'),
      ),
    );

    this.dateToPickerConfig = computed(() =>
      ErpDatePickerBuilder.create((b) =>
        b.setLabel(REPORT_KEYS.params.dateTo.label).setStrategy('single').setMode('date'),
      ),
    );

    this.dateFromControl.valueChanges.subscribe((value) => this.store.dateFrom.set(tuiDayToIso(value)));
    this.dateToControl.valueChanges.subscribe((value) => this.store.dateTo.set(tuiDayToIso(value)));

    this.generateButtonConfig = computed(() =>
      ErpButtonBuilder.create((b) =>
        b
          .setLabel(REPORT_KEYS.params.generate)
          .setAppearance('primary')
          .setDisabled(!this.store.isDateRangeValid() || this.store.isGenerating())
          .setLoading(this.store.isGenerating())
          .setFn(() => this.store.generateAsync()),
      ),
    );

    // Widoczny tylko w trakcie generowania — siatka bezpieczeństwa na wypadek, gdyby
    // wewnętrzna pętla odpytywania store'u (`_pollUntilFinishedAsync`) już się poddała
    // (`POLL_TIMEOUT_MS`), a raport mimo to się zakończył.
    this.refreshButtonConfig = computed(() =>
      ErpButtonBuilder.create((b) =>
        b
          .setLabel(REPORT_KEYS.status.refresh)
          .setAppearance('flat')
          .setSize('s')
          .setFn(() => this.store.refreshAsync()),
      ),
    );

    // RPT-009: pobranie CSV do wewnętrznego renderowania (fetch w store) nie zastępuje
    // świadomej akcji „zapisz na dysk" widocznej na stronie.
    this.downloadButtonConfig = computed(() =>
      ErpButtonBuilder.create((b) =>
        b
          .setLabel(REPORT_KEYS.status.download)
          .setAppearance('secondary')
          .setSize('m')
          .setIconStart('@tui.download')
          .setFn(() => this.store.downloadCsv()),
      ),
    );
  }

  /**
   * Spłaszcza dział+zagadnienia w jedną listę wierszy klienckich `erp-table` — kolumny okresów
   * i sumy niosą liczby dla WIERSZA GRUPY, nie tylko liścia (`ErpGroupedRowsConfig` renderuje
   * rodzica jako czysty tytuł, bez kolumn — dział bez sumy per okres byłby regresją względem
   * poprzedniego, bespoke renderera). Rozwiń/zwiń jest więc zwykłym filtrem `items`, nie
   * wbudowanym mechanizmem grupowania.
   */
  protected pivotTableConfig(pivot: ReportPivotData): ErpTableConfig<ErpReportPivotRow> {
    const expanded = this._expandedGroups();

    const rows: ErpReportPivotRow[] = pivot.departments.flatMap((department) => {
      const groupRow: ErpReportPivotRow = {
        kind: 'group',
        code: department.code,
        name: department.name,
        hoursByPeriod: department.hoursByPeriod,
        total: department.total,
      };

      if (!expanded.has(department.code)) {
        return [groupRow];
      }

      return [
        groupRow,
        ...department.zagadnienia.map(
          (leaf): ErpReportPivotRow => ({
            kind: 'leaf',
            groupCode: department.code,
            key: leaf.key,
            hoursByPeriod: leaf.hoursByPeriod,
            total: leaf.total,
          }),
        ),
      ];
    });

    const builder = new ErpTableBuilder<ErpReportPivotRow>()
      .setMode('client')
      .setRowIdAccessor((row) => (row.kind === 'group' ? `g:${row.code}` : `l:${row.groupCode}:${row.key}`))
      .setItems(rows)
      .setSelectionMode('none')
      .setEnableColumnResizing(false)
      .setEmptyMessage(REPORT_KEYS.noData)
      .addColumn((c) =>
        c
          .setId('label')
          .setHeader(REPORT_KEYS.table.department)
          .setEnableSorting(false)
          .setSize(280)
          .setCell(ErpReportPivotLabelCellComponent, {
            isExpanded: (row: ErpReportPivotRow) => row.kind === 'group' && expanded.has(row.code),
            onToggle: (row: ErpReportPivotRow) => this._toggleGroup(row),
          }),
      );

    for (const period of pivot.periods) {
      builder.addColumn((c) =>
        c
          .setId(period)
          .setAccessorFn((row) => row.hoursByPeriod.get(period) ?? 0)
          .setHeader(period)
          .setAlign('right')
          .setSize(100)
          .setGrow(0),
      );
    }

    builder.addColumn((c) =>
      c
        .setId('total')
        .setAccessorFn((row) => row.total)
        .setHeader(REPORT_KEYS.table.total)
        .setAlign('right')
        .setSize(100)
        .setGrow(0),
    );

    return builder.build();
  }

  private _toggleGroup(row: ErpReportPivotRow): void {
    if (row.kind !== 'group') {
      return;
    }

    this._expandedGroups.update((current) => {
      const next = new Set(current);

      if (next.has(row.code)) {
        next.delete(row.code);
      } else {
        next.add(row.code);
      }

      return next;
    });
  }

  protected rowsTableConfig(data: ReportRowsData): ErpTableConfig<ReportRow> {
    const items: ReportRow[] = data.rows.map((values, index) => ({ index, values }));
    const visible = this._visibleColumnIndexes(data.headers);

    const builder = new ErpTableBuilder<ReportRow>()
      .setMode('client')
      .setRowIdAccessor((row) => String(row.index))
      .setItems(items)
      .setSelectionMode('none')
      .setEmptyMessage(REPORT_KEYS.noData);

    for (const idx of visible) {
      const header = data.headers[idx];

      builder.addColumn((c) =>
        c
          .setId(header)
          .setAccessorFn((row) => this._cellValue(header, row.values[idx]))
          .setHeader(this._columnLabel(header)),
      );
    }

    return builder.build();
  }

  private _visibleColumnIndexes(headers: readonly string[]): number[] {
    return headers.map((_, idx) => idx).filter((idx) => !HIDDEN_COLUMNS.has(headers[idx]));
  }

  private readonly _columnLabel = (header: string): string => COLUMN_LABEL_KEYS[header] ?? header;

  /** `assignee_uuid` jest jedynym identyfikatorem osoby w wynikach generycznej tabeli — rozwiązany
   * na nazwisko przez katalog użytkowników (opcjonalny port, patrz `ERP_USER_DIRECTORY`), z uuidem
   * jako fallback dopóki paczka nazwisk nie dojedzie albo gdy katalog nie jest dostępny. */
  private readonly _cellValue = (header: string, value: string): string => {
    if (header === 'assignee_uuid' && value) {
      const user = this._directory?.getOne(value)();
      return user?.displayName ?? value;
    }

    return value;
  };
}
