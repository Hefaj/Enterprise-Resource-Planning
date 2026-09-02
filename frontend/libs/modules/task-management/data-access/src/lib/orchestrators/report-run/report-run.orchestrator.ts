import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';

import { BaseOrchestrator, JobMeta, LoadOptions, OrchestratorConfig } from '@erp/shared/data-access';
import { TASK_MANAGEMENT_JOB_COMMAND_KEYS } from '@erp/task-management/util';

import {
  GetReportRunRequest,
  ReportRunCreateCommand,
  ReportRunDto,
  SearchReportRunRequest,
  SearchResponse,
  TaskManagementClient,
} from '../../api-client';

/**
 * Orkiestrator przebiegów raportów (`ReportRun` — RPT-002, PERM-005).
 *
 * <p><b>`create` nie idzie przez `runSingleCommandAsync`</b>, mimo że tak wygląda niemal każda
 * inna komenda w tym module: `ReportRunCreateCommandEndpoint` świadomie NIE jest endpointem
 * wsadowym (`BatchEndpointBase`) — przyjmuje `ReportRunCreateCommand` wprost, nie
 * `{ commands: [...] }` (patrz `TaskManagement.Api/Reports/Command/ReportRunCreateCommandEndpoint.cs`).
 * Zwraca za to ten sam kształt (`BatchResult` z `jobUuid`), więc rejestracja w `JobService`
 * jest budowana ręcznie tutaj, tym samym wzorcem co `runBatchCommandAsync`.</p>
 *
 * <p>`getReportRun` niesie kilka uuidów naraz (`GetReportRunRequest.uuids`), więc — inaczej niż
 * przy sprintach — dogranie brakujących wpisów w cache'u idzie jednym żądaniem, nie równoległymi.</p>
 */
@Injectable({ providedIn: 'root' })
export class TaskManagementReportRunOrchestrator extends BaseOrchestrator<
  ReportRunDto,
  ReportRunDto,
  SearchReportRunRequest,
  LoadOptions
> {
  private readonly _api = inject(TaskManagementClient);

  protected override readonly signature = 'taskmgmt.report_run';

  protected override readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string } = {
    signalrSignature: 'taskmgmt.report_run',
    maxCacheSize: 100,
  };

  protected override fetchByUuids(uuids: string[]): Observable<ReportRunDto[]> {
    if (uuids.length === 0) {
      return of([]);
    }

    return this._api.getReportRun({ uuids } as GetReportRunRequest);
  }

  protected override searchByFilters(filters: SearchReportRunRequest): Observable<SearchResponse> {
    return this._api.searchReportRun(filters);
  }

  protected override mapToViewModel(dto: ReportRunDto): ReportRunDto {
    return dto;
  }

  /**
   * Wymusza przeładowanie przebiegu z serwera, pomijając cache — inaczej niż `loadAsync`,
   * które dla już załadowanego uuid jest no-opem (`DataLoader.loadAsync` filtruje po
   * `IdentityMapStore.getMissing`). Strona raportu odpytuje tym stan przebiegu w pętli, dopóki
   * nie osiągnie stanu końcowego (`ReportStore._pollUntilFinishedAsync`) — samo zdarzenie
   * SignalR (`taskmgmt.report_run`) bywa zawodne przy niestabilnym połączeniu, więc nie jest
   * jedynym źródłem odświeżenia.
   */
  public reloadAsync(uuids: string[]): Promise<void> {
    return this.dataLoader.reloadAsync(uuids);
  }

  /**
   * Zleca przebieg raportu i zwraca zarówno `jobUuid` (do feedu zadań), jak i `runUuid`
   * (do odpytania `getReportRunDownloadUrl` po zakończeniu, przez {@link reloadAsync}
   * w pętli — patrz komentarz tam).
   */
  public async createAsync(
    reportKey: string,
    format: string,
    parametersJson: string,
    queueId?: string,
  ): Promise<{ jobUuid: string; runUuid: string }> {
    const uuid = crypto.randomUUID();
    const command: ReportRunCreateCommand = { uuid, reportKey, format, parametersJson };

    const meta: JobMeta = {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.createReport,
      aggregateUuid: uuid,
      notifyOnComplete: true,
      timestamp: new Date(),
    };

    const result = await this.runDirectCommandAsync(() => this._api.reportRunCreateCommand(command));
    const jobUuid = result.jobUuid ?? '';

    this.jobService.addJob(jobUuid, queueId, meta);

    await this.loadAsync([uuid]);

    return { jobUuid, runUuid: uuid };
  }
}
