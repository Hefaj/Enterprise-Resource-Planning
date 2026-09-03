import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ErpToastService } from '@erp/shared/ui';
import {
  SearchProjectRequest,
  TaskManagementClient,
  TaskManagementProjectOrchestrator,
  TaskManagementReportRunOrchestrator,
} from '@erp/task-management/data-access';

import { REPORT_KEYS } from '../translation';
import { ReportPivotData, ReportRowsData, parseReportCsvToPivot, parseReportCsvToRows } from './report-pivot';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Odstęp odpytywania stanu przebiegu — patrz komentarz przy `_pollUntilFinishedAsync`. */
const POLL_INTERVAL_MS = 1_000;

/** Po tym czasie przestajemy odpytywać automatycznie; `refreshAsync()` z przycisku „Odśwież”
 * nadal działa. */
const POLL_TIMEOUT_MS = 120_000;

/** Kopia `ReportRunStatus` z backendu (`Erp.BuildingBlocks.Reporting/ReportRunStatus.cs`) —
 * wartości liczbowe, `ReportRunDto.status` przyjeżdża jako `number`. */
const REPORT_RUN_STATUS = {
  Pending: 0,
  Running: 1,
  Completed: 2,
  Failed: 3,
} as const;

/**
 * Katalog pięciu definicji raportu Task Management (RPT-002 `Must`, RPT-003 `Should`) —
 * jedyne miejsce, które front musi dopisać, żeby nowa definicja backendu pojawiła się w
 * dropdownie. `hasPivot` wybiera renderer wyniku: `hours-by-department` ma bespoke pivot
 * dział×zagadnienie×okres (`parseReportCsvToPivot`), pozostałe cztery renderują się generyczną
 * tabelą nagłówek+wiersze (`parseReportCsvToRows`) — ich kształty są naprawdę różne (liczność,
 * mediana, zgodność SLA, postęp sprintu), więc wymuszanie ich we wspólny pivot byłoby sztuczne.
 */
export interface ReportDefinitionSpec {
  readonly key: string;
  readonly label: string;
  readonly hasPivot: boolean;
  readonly needsDateRange: boolean;
  readonly needsProjects: boolean;
}

export const REPORT_DEFINITIONS: readonly ReportDefinitionSpec[] = [
  { key: 'taskmgmt.hours-by-department', label: REPORT_KEYS.reports.hoursByDepartment, hasPivot: true, needsDateRange: true, needsProjects: true },
  { key: 'taskmgmt.issues-by-state-type-assignee', label: REPORT_KEYS.reports.issuesByStateTypeAssignee, hasPivot: false, needsDateRange: false, needsProjects: true },
  { key: 'taskmgmt.cycle-time-by-state-category', label: REPORT_KEYS.reports.cycleTimeByStateCategory, hasPivot: false, needsDateRange: true, needsProjects: true },
  { key: 'taskmgmt.sla-compliance', label: REPORT_KEYS.reports.slaCompliance, hasPivot: false, needsDateRange: true, needsProjects: true },
  { key: 'taskmgmt.sprint-progress', label: REPORT_KEYS.reports.sprintProgress, hasPivot: false, needsDateRange: false, needsProjects: false },
  { key: 'taskmgmt.sprint-workload', label: REPORT_KEYS.reports.sprintWorkload, hasPivot: false, needsDateRange: false, needsProjects: false },
] as const;

const REPORT_FORMAT = 'csv';

/**
 * Store strony `/task-management/report` (faza 7, RPT-002/RPT-004; RPT-003 doszło w domknięciu
 * fazy 7).
 *
 * <p>Status przebiegu raportu przychodzi realtime kanałem `taskmgmt.report_run`
 * (`TaskManagementReportRunOrchestrator`, sygnatura zarejestrowana w `AggregateSignatures`),
 * ale store <b>nie polega na tym wyłącznie</b> — po zleceniu odpytuje `getReportRun` w pętli
 * (`_pollUntilFinishedAsync`), tym samym `effect()` obserwującym `getViewModel()`, które
 * i tak reaguje na każdą aktualizację cache'u niezależnie od jej źródła (SignalR czy zwykłe
 * `loadAsync`). Weryfikacja pokazała, że samo zdarzenie realtime bywa zawodne przy
 * niestabilnym połączeniu WebSocket (rekoneksje) — a raport, który wygenerował się poprawnie,
 * ale strona o tym nie wie, jest gorszym błędem niż jedno zbędne zapytanie na sekundę.</p>
 */
@Injectable()
export class ReportStore {
  private readonly _reportRuns = inject(TaskManagementReportRunOrchestrator);
  private readonly _projects = inject(TaskManagementProjectOrchestrator);
  private readonly _api = inject(TaskManagementClient);
  private readonly _toast = inject(ErpToastService);

  /** Projekty widoczne dla użytkownika — źródło opcji pickera „dział"/„projekty" (departament =
   * projekt wykonawczy, patrz §9.4 dokumentacji stron). Ładowane raz, przy montowaniu store'u. */
  public readonly departments = computed(() => [...this._projects.getViewModel()().values()]);

  public readonly reportKey = signal<string>(REPORT_DEFINITIONS[0].key);

  public readonly currentDefinition = computed<ReportDefinitionSpec>(
    () => REPORT_DEFINITIONS.find((d) => d.key === this.reportKey()) ?? REPORT_DEFINITIONS[0],
  );

  public readonly dateFrom = signal<string>('');
  public readonly dateTo = signal<string>('');
  public readonly departmentUuids = signal<string[]>([]);

  public readonly isGenerating = signal<boolean>(false);
  public readonly isFetchingArtifact = signal<boolean>(false);
  public readonly errorMessage = signal<string | null>(null);

  /** Wynik pivotowy — wyłącznie dla `hours-by-department` (`currentDefinition().hasPivot`). */
  public readonly pivot = signal<ReportPivotData | null>(null);

  /** Wynik generyczny nagłówek+wiersze — dla pozostałych czterech definicji RPT-003. */
  public readonly rows = signal<ReportRowsData | null>(null);

  private readonly _runUuid = signal<string | null>(null);
  private _pivotFetchedForRun: string | null = null;

  public readonly isDateRangeValid = computed(() => {
    if (!this.currentDefinition().needsDateRange) {
      return true;
    }

    const from = this.dateFrom();
    const to = this.dateTo();
    return ISO_DATE_RE.test(from) && ISO_DATE_RE.test(to) && from <= to;
  });

  public readonly currentRun = computed(() => {
    const uuid = this._runUuid();
    return uuid ? this._reportRuns.getViewModel()().get(uuid) : undefined;
  });

  public constructor() {
    // Lista projektów jest krótka (dziesiątki, nie tysiące — patrz komentarz w
    // `TaskManagementProjectOrchestrator`), więc jedno niepaginowane wyszukanie wystarcza
    // do zasilenia pickera „dział"/„projekty".
    void this._projects.searchAsync({} as SearchProjectRequest);

    effect(() => {
      const run = this.currentRun();
      if (!run) {
        return;
      }

      if (run.status === REPORT_RUN_STATUS.Failed) {
        this.isGenerating.set(false);
        this.errorMessage.set(run.errorCode || REPORT_KEYS.errors.runFailed);
        return;
      }

      if (run.status === REPORT_RUN_STATUS.Completed && this._pivotFetchedForRun !== run.uuid) {
        this.isGenerating.set(false);
        this._pivotFetchedForRun = run.uuid;
        void this._fetchArtifactAsync(run.uuid);
      }
    });
  }

  /** Zmiana raportu w dropdownie — czyści wynik poprzedniego, żeby stara tabela nie wisiała pod
   * nowym formularzem parametrów, którego kolumny jej nie dotyczą. */
  public selectReport(key: string): void {
    if (key === this.reportKey()) {
      return;
    }

    this.reportKey.set(key);
    this.errorMessage.set(null);
    this.pivot.set(null);
    this.rows.set(null);
    this._runUuid.set(null);
    this._pivotFetchedForRun = null;
  }

  public async generateAsync(): Promise<void> {
    if (!this.isDateRangeValid() || this.isGenerating()) {
      return;
    }

    const definition = this.currentDefinition();

    this.errorMessage.set(null);
    this.pivot.set(null);
    this.rows.set(null);
    this._pivotFetchedForRun = null;
    this.isGenerating.set(true);

    const parameters: Record<string, unknown> = {};

    if (definition.needsDateRange) {
      parameters['dateFrom'] = this.dateFrom();
      parameters['dateTo'] = this.dateTo();
    }

    if (definition.needsProjects && this.departmentUuids().length > 0) {
      // Backend przyjmuje ten sam kod parametru pod dwoma nazwami zależnie od definicji
      // (`DepartmentUuids` dla hours-by-department, `ProjectUuids` dla reszty) — front wysyła
      // oba klucze naraz, deserializacja JSON po stronie .NET jest wielkości liter niewrażliwa
      // i ignoruje nieznane pola, więc to nie psuje żadnej z definicji.
      parameters['departmentUuids'] = this.departmentUuids();
      parameters['projectUuids'] = this.departmentUuids();
    }

    const parametersJson = JSON.stringify(parameters);

    try {
      const { runUuid } = await this._reportRuns.createAsync(definition.key, REPORT_FORMAT, parametersJson);
      this._runUuid.set(runUuid);
      void this._pollUntilFinishedAsync(runUuid);
    } catch (err) {
      this.isGenerating.set(false);
      this.errorMessage.set(err instanceof Error ? err.message : String(err));
      this._toast.show({ message: REPORT_KEYS.errors.generateFailed, appearance: 'negative' });
    }
  }

  /** Przycisk „Odśwież” w UI — wymusza ponowne pobranie stanu przebiegu wprost z serwera poza
   * zaplanowaną pętlą (np. gdy użytkownik wrócił po timeout-cie odpytywania). */
  public async refreshAsync(): Promise<void> {
    const uuid = this._runUuid();
    if (!uuid) {
      return;
    }
    await this._reportRuns.reloadAsync([uuid]);
  }

  /** Odpytuje stan przebiegu co `POLL_INTERVAL_MS`, aż osiągnie stan końcowy albo upłynie
   * `POLL_TIMEOUT_MS`. Woła `reloadAsync` (nie `loadAsync` — ten dla już załadowanego uuid jest
   * no-opem, patrz komentarz w orkiestratorze), więc każdy obrót pętli faktycznie odpytuje
   * serwer i odświeża identity mapę; `effect()` w konstruktorze — obserwujący `getViewModel()`
   * — sam zauważy przejście do `Completed` i uruchomi pobranie artefaktu. */
  private async _pollUntilFinishedAsync(runUuid: string): Promise<void> {
    const attempts = Math.ceil(POLL_TIMEOUT_MS / POLL_INTERVAL_MS);

    for (let attempt = 0; attempt < attempts; attempt++) {
      if (this._runUuid() !== runUuid) {
        // Użytkownik zlecił nowy raport w międzyczasie — ta pętla straciła aktualność.
        return;
      }

      await this._reportRuns.reloadAsync([runUuid]);

      const run = this._reportRuns.getViewModel()().get(runUuid);
      if (run?.status === REPORT_RUN_STATUS.Completed || run?.status === REPORT_RUN_STATUS.Failed) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    // Timeout — nie błąd (patrz `erpAwaitJobAsync`, ten sam uzasadnienie): raport nadal może
    // się udać, przestajemy tylko dopytywać automatycznie.
    if (this._runUuid() === runUuid) {
      this.isGenerating.set(false);
    }
  }

  private async _fetchArtifactAsync(runUuid: string): Promise<void> {
    this.isFetchingArtifact.set(true);

    try {
      const download = await firstValueFrom(this._api.getReportRunDownloadUrl({ uuid: runUuid }));
      const response = await fetch(download.url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const csvText = await response.text();

      if (this.currentDefinition().hasPivot) {
        this.pivot.set(parseReportCsvToPivot(csvText));
      } else {
        this.rows.set(parseReportCsvToRows(csvText));
      }
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : String(err));
      this._toast.show({ message: REPORT_KEYS.errors.downloadFailed, appearance: 'negative' });
    } finally {
      this.isFetchingArtifact.set(false);
    }
  }
}
