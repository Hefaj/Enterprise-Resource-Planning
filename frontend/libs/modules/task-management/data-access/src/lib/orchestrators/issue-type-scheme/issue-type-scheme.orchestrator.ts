import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { BaseOrchestrator, LoadOptions, OrchestratorConfig } from '@erp/shared/data-access';
import { TASK_MANAGEMENT_JOB_COMMAND_KEYS } from '@erp/task-management/util';

import {
  IssueTypeSchemeAddTypeCommand,
  IssueTypeSchemeCreateCommand,
  IssueTypeSchemeDto,
  IssueTypeSchemeRemoveTypeCommand,
  IssueTypeSchemeSetTypeCommand,
  SearchIssueTypeSchemeRequest,
  SearchResponse,
  TaskManagementClient,
} from '../../api-client';

/**
 * Orkiestrator schematów typów zgłoszeń (`IssueTypeScheme` — `TYP-001`..`004`).
 *
 * <p><b>Odczyt idzie jednym zapytaniem po całości</b>, dokładnie jak
 * {@link TaskManagementFieldSchemeOrchestrator}: schematów jest kilka, każdy niesie swoje typy
 * razem z sobą (`IssueTypeSchemeDto.types`), a backend nie wystawia dla nich stronicowania —
 * ekran konfiguracji zawsze pokazuje je w całości.</p>
 *
 * <p>Sygnatura realtime `taskmgmt.issue_type_scheme` — typ dodany z UI (nowy `Incydent`) ma
 * pojawić się w modalu tworzenia zgłoszenia bez wdrożenia (`§2.8` planu), więc kanał musi się
 * zgadzać z `AggregateSignatures.TaskManagementIssueTypeScheme` po stronie backendu.</p>
 */
@Injectable({ providedIn: 'root' })
export class TaskManagementIssueTypeSchemeOrchestrator extends BaseOrchestrator<
  IssueTypeSchemeDto,
  IssueTypeSchemeDto,
  SearchIssueTypeSchemeRequest,
  LoadOptions
> {
  private readonly _api = inject(TaskManagementClient);

  protected override readonly signature = 'taskmgmt.issue_type_scheme';

  protected override readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string } = {
    signalrSignature: 'taskmgmt.issue_type_scheme',
    maxCacheSize: 200,
  };

  protected override fetchByUuids(uuids: string[]): Observable<IssueTypeSchemeDto[]> {
    return this._api
      .searchIssueTypeScheme({} as SearchIssueTypeSchemeRequest)
      .pipe(map((schemes) => schemes.filter((scheme) => uuids.includes(scheme.uuid))));
  }

  protected override searchByFilters(filters: SearchIssueTypeSchemeRequest): Observable<SearchResponse> {
    return this._api
      .searchIssueTypeScheme(filters)
      .pipe(
        map(
          (schemes) => ({ uuids: schemes.map((s) => s.uuid), totalCount: schemes.length }) as SearchResponse,
        ),
      );
  }

  protected override mapToViewModel(dto: IssueTypeSchemeDto): IssueTypeSchemeDto {
    return dto;
  }

  /** Zakłada schemat typów. `uuid` generuje klient — tryb `Commands[]` wymaga go w payloadzie. */
  public async createAsync(command: IssueTypeSchemeCreateCommand, queueId?: string): Promise<string> {
    const uuid = crypto.randomUUID();

    const jobUuid = await this.runSingleCommandAsync(
      (p) => this._api.issueTypeSchemeCreateMultipleCommand(p),
      { ...command, uuid } as IssueTypeSchemeCreateCommand,
      { commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.createIssueTypeScheme, queueId },
    );

    await this.loadAsync([uuid]);
    return jobUuid;
  }

  /** Dokłada typ do schematu — pojawia się w modalu tworzenia zgłoszenia bez wdrożenia
   * frontendu, bo to sam schemat, nie stała w kodzie, ogranicza wybór (`TYP-002`). */
  public addTypeAsync(command: IssueTypeSchemeAddTypeCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync(
      (p) => this._api.issueTypeSchemeAddTypeMultipleCommand(p),
      { ...command, typeUuid: command.typeUuid || crypto.randomUUID() } as IssueTypeSchemeAddTypeCommand,
      { commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.addIssueTypeSchemeType, queueId },
    );
  }

  /** Zmienia definicję typu w schemacie (nazwa, ikona, kolejność, nadpisania schematów). */
  public setTypeAsync(command: IssueTypeSchemeSetTypeCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.issueTypeSchemeSetTypeMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setIssueTypeSchemeType,
      queueId,
    });
  }

  /** Usuwa typ ze schematu. Backend odmawia (`TYP-004`, `IssueTypeInUseRule`), gdy jakiekolwiek
   * zgłoszenie ma jeszcze ten typ — front nie duplikuje tej reguły, tylko pokazuje jej wynik. */
  public removeTypeAsync(command: IssueTypeSchemeRemoveTypeCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.issueTypeSchemeRemoveTypeMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.removeIssueTypeSchemeType,
      queueId,
    });
  }
}
