import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { BaseOrchestrator, LoadOptions, OrchestratorConfig } from '@erp/shared/data-access';
import { TASK_MANAGEMENT_JOB_COMMAND_KEYS } from '@erp/task-management/util';

import {
  GetWorkflowSchemePublishPreviewRequest,
  SearchResponse,
  SearchWorkflowSchemeRequest,
  TaskManagementClient,
  WorkflowSchemeAddStateCommand,
  WorkflowSchemeAddTransitionCommand,
  WorkflowSchemeCreateCommand,
  WorkflowSchemeDto,
  WorkflowSchemeExecPublishCommand,
  WorkflowSchemePublishPreviewDto,
  WorkflowSchemeRemoveStateCommand,
  WorkflowSchemeRemoveTransitionCommand,
  WorkflowSchemeSetStateCommand,
  WorkflowSchemeSetTransitionCommand,
} from '../../api-client';

/**
 * Orkiestrator schematów stanów (`WorkflowScheme` — `WF-006`/`WF-007`).
 *
 * <p>Wzorem {@link TaskManagementIssueTypeSchemeOrchestrator}: odczyt idzie jednym zapytaniem po
 * całości (`searchWorkflowScheme` bez stronicowania — schemat niesie swoje stany i przejścia razem
 * z sobą w `WorkflowSchemeDto.states`/`.transitions`), sygnatura realtime
 * `taskmgmt.workflow_scheme` już jest zarejestrowana w `AggregateSignatures` po stronie backendu.</p>
 */
@Injectable({ providedIn: 'root' })
export class TaskManagementWorkflowSchemeOrchestrator extends BaseOrchestrator<
  WorkflowSchemeDto,
  WorkflowSchemeDto,
  SearchWorkflowSchemeRequest,
  LoadOptions
> {
  private readonly _api = inject(TaskManagementClient);

  protected override readonly signature = 'taskmgmt.workflow_scheme';

  protected override readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string } = {
    signalrSignature: 'taskmgmt.workflow_scheme',
    maxCacheSize: 200,
  };

  protected override fetchByUuids(uuids: string[]): Observable<WorkflowSchemeDto[]> {
    const wanted = new Set(uuids);

    return this._api
      .searchWorkflowScheme({} as SearchWorkflowSchemeRequest)
      .pipe(map((schemes) => schemes.filter((scheme) => wanted.has(scheme.uuid))));
  }

  protected override searchByFilters(filters: SearchWorkflowSchemeRequest): Observable<SearchResponse> {
    return this._api
      .searchWorkflowScheme(filters)
      .pipe(
        map((schemes) => ({ uuids: schemes.map((s) => s.uuid), totalCount: schemes.length }) as SearchResponse),
      );
  }

  protected override mapToViewModel(dto: WorkflowSchemeDto): WorkflowSchemeDto {
    return dto;
  }

  /** Podgląd wpływu publikacji na usuwane stany (liczba zgłoszeń w każdym) — zasila modal
   * mapowania stanów przed `execPublishAsync` (WF-006). Zapytanie proste, nie idzie przez cache. */
  public getPublishPreviewAsync(
    request: GetWorkflowSchemePublishPreviewRequest,
  ): Promise<WorkflowSchemePublishPreviewDto> {
    return this.runDirectCommandAsync(() => this._api.getWorkflowSchemePublishPreview(request));
  }

  /** Zakłada schemat stanów. `uuid` generuje klient — tryb `Commands[]` wymaga go w payloadzie. */
  public async createAsync(command: WorkflowSchemeCreateCommand, queueId?: string): Promise<string> {
    const uuid = crypto.randomUUID();

    const jobUuid = await this.runSingleCommandAsync(
      (p) => this._api.workflowSchemeCreateMultipleCommand(p),
      { ...command, uuid } as WorkflowSchemeCreateCommand,
      { commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.createWorkflowScheme, queueId },
    );

    await this.loadAsync([uuid]);
    return jobUuid;
  }

  /** Dokłada stan do schematu. */
  public async addStateAsync(command: WorkflowSchemeAddStateCommand, queueId?: string): Promise<string> {
    const jobUuid = await this.runSingleCommandAsync(
      (p) => this._api.workflowSchemeAddStateMultipleCommand(p),
      { ...command, stateUuid: command.stateUuid || crypto.randomUUID() } as WorkflowSchemeAddStateCommand,
      { commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.addWorkflowSchemeState, queueId },
    );

    if (command.uuid) {
      await this.loadAsync([command.uuid]);
    }

    return jobUuid;
  }

  /** Zmienia definicję stanu (nazwa, kategoria, kolejność). */
  public async setStateAsync(command: WorkflowSchemeSetStateCommand, queueId?: string): Promise<string> {
    const jobUuid = await this.runSingleCommandAsync((p) => this._api.workflowSchemeSetStateMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setWorkflowSchemeState,
      queueId,
    });

    if (command.uuid) {
      await this.loadAsync([command.uuid]);
    }

    return jobUuid;
  }

  /** Usuwa stan bez zgłoszeń w nim. Backend odmawia, gdy stan jest jeszcze używany przez
   * przejście (macierz „z→do" musi pozostać spójna) albo ma otwarte zgłoszenia — dla tego
   * drugiego przypadku front kieruje do {@link execPublishAsync}, nie wywołuje tej metody. */
  public async removeStateAsync(command: WorkflowSchemeRemoveStateCommand, queueId?: string): Promise<string> {
    const jobUuid = await this.runSingleCommandAsync(
      (p) => this._api.workflowSchemeRemoveStateMultipleCommand(p),
      command,
      { commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.removeWorkflowSchemeState, queueId },
    );

    if (command.uuid) {
      await this.loadAsync([command.uuid]);
    }

    return jobUuid;
  }

  /** Dokłada przejście „z→do" do schematu. */
  public async addTransitionAsync(command: WorkflowSchemeAddTransitionCommand, queueId?: string): Promise<string> {
    const jobUuid = await this.runSingleCommandAsync(
      (p) => this._api.workflowSchemeAddTransitionMultipleCommand(p),
      {
        ...command,
        transitionUuid: command.transitionUuid || crypto.randomUUID(),
      } as WorkflowSchemeAddTransitionCommand,
      { commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.addWorkflowSchemeTransition, queueId },
    );

    if (command.uuid) {
      await this.loadAsync([command.uuid]);
    }

    return jobUuid;
  }

  /** Zmienia definicję przejścia (nazwa, wymagane uprawnienie, wymagane pola). */
  public async setTransitionAsync(command: WorkflowSchemeSetTransitionCommand, queueId?: string): Promise<string> {
    const jobUuid = await this.runSingleCommandAsync(
      (p) => this._api.workflowSchemeSetTransitionMultipleCommand(p),
      command,
      { commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setWorkflowSchemeTransition, queueId },
    );

    if (command.uuid) {
      await this.loadAsync([command.uuid]);
    }

    return jobUuid;
  }

  /** Usuwa przejście ze schematu. */
  public async removeTransitionAsync(
    command: WorkflowSchemeRemoveTransitionCommand,
    queueId?: string,
  ): Promise<string> {
    const jobUuid = await this.runSingleCommandAsync(
      (p) => this._api.workflowSchemeRemoveTransitionMultipleCommand(p),
      command,
      { commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.removeWorkflowSchemeTransition, queueId },
    );

    if (command.uuid) {
      await this.loadAsync([command.uuid]);
    }

    return jobUuid;
  }

  /** Publikuje usunięcie stanów z zgłoszeniami — zakłada zadanie masowe, które migruje każde
   * zgłoszenie siedzące w usuwanym stanie do stanu docelowego wskazanego w `mapping`
   * (WF-006 AC2: mapping musi pokrywać wszystkie usuwane stany, inaczej backend odrzuca). */
  public execPublishAsync(command: WorkflowSchemeExecPublishCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.workflowSchemeExecPublishMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.execPublishWorkflowScheme,
      queueId,
    });
  }
}
