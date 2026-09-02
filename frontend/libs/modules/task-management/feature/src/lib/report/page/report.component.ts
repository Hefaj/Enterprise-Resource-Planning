import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import {
  ErpButtonBuilder,
  ErpButtonComponent,
  ErpEmptyStateComponent,
  ErpInputPickerBuilder,
  ErpInputPickerComponent,
  ErpInputPickerConfig,
  ErpTranslatePipe,
} from '@erp/shared/ui';

import { REPORT_KEYS, provideReportTranslations } from '../translation';
import { ReportStore } from './report.store';

/**
 * Strona `/task-management/report` — raport rozliczenia godzin (faza 7, RPT-002/RPT-004).
 *
 * <p><b>Świadomie łamie wzorzec `erp-grid-layout` + filtr + tabela</b> (jak `BoardComponent` —
 * patrz komentarz tam): to nie lista agregatu z filtrami po boku, tylko formularz parametrów
 * nad wynikiem, który po wygenerowaniu zajmuje resztę strony jako tabela przestawna.</p>
 *
 * <p><b>Rozwinięcie wiersza działu kończy się na zagadnieniu</b> — CSV z backendu nie niesie
 * tytułu ani klucza zgłoszenia, więc nie ma tu ryzyka wycieku do listy zgłoszeń, do której
 * czytelnik raportu (kierownictwo, PERM-005) może nie mieć dostępu.</p>
 */
@Component({
  selector: 'erp-task-management-report',
  standalone: true,
  imports: [
    ErpButtonComponent,
    ErpEmptyStateComponent,
    ErpInputPickerComponent,
    ErpTranslatePipe,
    ReactiveFormsModule,
  ],
  providers: [ReportStore, provideReportTranslations()],
  template: `
    <div class="flex h-full min-h-0 w-full flex-col gap-4 p-4">
      <div class="flex flex-wrap items-end gap-3">
        <label class="flex flex-col gap-1 text-sm">
          <span>{{ REPORT_KEYS.params.dateFrom.label | erpTranslate }}</span>
          <input
            type="text"
            class="rounded border border-[var(--tui-border-normal)] bg-transparent px-2 py-1.5 text-sm"
            [placeholder]="REPORT_KEYS.params.dateFrom.placeholder | erpTranslate"
            [value]="this.store.dateFrom()"
            (input)="this.store.dateFrom.set($any($event.target).value)"
          />
        </label>

        <label class="flex flex-col gap-1 text-sm">
          <span>{{ REPORT_KEYS.params.dateTo.label | erpTranslate }}</span>
          <input
            type="text"
            class="rounded border border-[var(--tui-border-normal)] bg-transparent px-2 py-1.5 text-sm"
            [placeholder]="REPORT_KEYS.params.dateTo.placeholder | erpTranslate"
            [value]="this.store.dateTo()"
            (input)="this.store.dateTo.set($any($event.target).value)"
          />
        </label>

        <erp-input-picker
          class="min-w-64"
          [config]="departmentPickerConfig()"
          [control]="departmentControl"
        />

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
        } @else if (!this.store.pivot()) {
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

  protected readonly departmentControl = new FormControl<string[]>([]);

  private readonly _expandedDepartments = signal<ReadonlySet<string>>(new Set());

  protected readonly departmentPickerConfig: ReturnType<typeof computed<ErpInputPickerConfig>>;
  protected readonly generateButtonConfig;
  protected readonly refreshButtonConfig;

  public constructor() {
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
}
