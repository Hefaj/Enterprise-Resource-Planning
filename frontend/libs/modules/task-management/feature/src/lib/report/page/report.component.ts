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
  ErpTranslatePipe,
  injectTranslationsReadySignal,
} from '@erp/shared/ui';
import { ERP_USER_DIRECTORY } from '@erp/shared/util';

import { REPORT_KEYS, provideReportTranslations } from '../translation';
import { REPORT_DEFINITIONS, ReportStore } from './report.store';

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
            @let pivot = this.store.pivot()!;

            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="border-b border-[var(--tui-border-normal)] text-left">
                  <th class="p-2">{{ REPORT_KEYS.table.department | erpTranslate }}</th>
                  @for (period of pivot.periods; track period) {
                    <th class="p-2 text-right">{{ period }}</th>
                  }
                  <th class="p-2 text-right">{{ REPORT_KEYS.table.total | erpTranslate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (dept of pivot.departments; track dept.code) {
                  <tr
                    class="cursor-pointer border-b border-[var(--tui-border-normal)] font-medium hover:bg-[var(--tui-background-neutral-1)]"
                    (click)="this.toggleDepartment(dept.code)"
                  >
                    <td class="p-2">
                      <span class="mr-1">{{ this.isExpanded(dept.code) ? '▾' : '▸' }}</span>
                      {{ dept.code }} — {{ dept.name }}
                    </td>
                    @for (period of pivot.periods; track period) {
                      <td class="p-2 text-right">{{ dept.hoursByPeriod.get(period) ?? 0 }}</td>
                    }
                    <td class="p-2 text-right">{{ dept.total }}</td>
                  </tr>

                  @if (this.isExpanded(dept.code)) {
                    @for (zag of dept.zagadnienia; track zag.key) {
                      <tr class="border-b border-[var(--tui-border-normal)] text-[var(--tui-text-secondary)]">
                        <td class="p-2 pl-8">{{ zag.key }}</td>
                        @for (period of pivot.periods; track period) {
                          <td class="p-2 text-right">{{ zag.hoursByPeriod.get(period) ?? 0 }}</td>
                        }
                        <td class="p-2 text-right">{{ zag.total }}</td>
                      </tr>
                    }
                  }
                }
              </tbody>
            </table>
          }
        } @else {
          @if (!this.store.rows()) {
            <erp-empty-state [config]="{ icon: '@tui.chart-bar', message: REPORT_KEYS.empty }" />
          } @else if (this.store.rows()!.rows.length === 0) {
            <erp-empty-state [config]="{ icon: '@tui.inbox', message: REPORT_KEYS.noData }" />
          } @else {
            @let data = this.store.rows()!;
            @let visibleIdx = this.visibleColumnIndexes(data.headers);

            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="border-b border-[var(--tui-border-normal)] text-left">
                  @for (idx of visibleIdx; track idx) {
                    <th class="p-2">{{ this.columnLabel(data.headers[idx]) | erpTranslate }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of data.rows; track $index) {
                  <tr class="border-b border-[var(--tui-border-normal)]">
                    @for (idx of visibleIdx; track idx) {
                      <td class="p-2">{{ this.cellValue(data.headers[idx], row[idx]) }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
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

  private readonly _expandedDepartments = signal<ReadonlySet<string>>(new Set());

  protected readonly reportPickerConfig: ReturnType<typeof computed<ErpInputPickerConfig>>;
  protected readonly departmentPickerConfig: ReturnType<typeof computed<ErpInputPickerConfig>>;
  protected readonly dateFromPickerConfig;
  protected readonly dateToPickerConfig;
  protected readonly generateButtonConfig;
  protected readonly refreshButtonConfig;

  public constructor() {
    this.reportPickerConfig = computed(() => {
      // Strażnik reaktywności Transloco — `computed` cache'uje wynik na zawsze, jeśli odczyta
      // `translate(...)` zanim scope się doładuje (systemowy bug znaleziony i udokumentowany
      // w fazie 6, patrz `PLAN-task-management.md` §10 wiersz „6"); `_translationsReady()` jest
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
  }

  protected toggleDepartment(code: string): void {
    this._expandedDepartments.update((current) => {
      const next = new Set(current);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }

  protected isExpanded(code: string): boolean {
    return this._expandedDepartments().has(code);
  }

  protected visibleColumnIndexes(headers: readonly string[]): number[] {
    return headers.map((_, idx) => idx).filter((idx) => !HIDDEN_COLUMNS.has(headers[idx]));
  }

  protected columnLabel(header: string): string {
    return COLUMN_LABEL_KEYS[header] ?? header;
  }

  /** `assignee_uuid` jest jedynym identyfikatorem osoby w wynikach generycznej tabeli — rozwiązany
   * na nazwisko przez katalog użytkowników (opcjonalny port, patrz `ERP_USER_DIRECTORY`), z uuidem
   * jako fallback dopóki paczka nazwisk nie dojedzie albo gdy katalog nie jest dostępny. */
  protected cellValue(header: string, value: string): string {
    if (header === 'assignee_uuid' && value) {
      const user = this._directory?.getOne(value)();
      return user?.displayName ?? value;
    }

    return value;
  }
}
