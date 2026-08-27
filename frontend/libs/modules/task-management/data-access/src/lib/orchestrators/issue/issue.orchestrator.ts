import { Injectable, Injector, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { BaseOrchestrator, LoadOptions, OrchestratorConfig, ResolvedDeps } from '@erp/shared/data-access';
import { TASK_MANAGEMENT_JOB_COMMAND_KEYS } from '@erp/task-management/util';

import {
  BatchCommandOfIssueSetAssigneeCommandAndSearchIssueRequest,
  BatchCommandOfIssueSetPriorityCommandAndSearchIssueRequest,
  BatchCommandOfIssueSetStateCommandAndSearchIssueRequest,
  GetIssueByKeyRequest,
  GetIssueRequest,
  IssueCreateCommand,
  IssueDto,
  IssueSetDescriptionCommand,
  IssueSetDueDateCommand,
  IssueSetStateCommand,
  IssueSetTitleCommand,
  SearchIssueRequest,
  SearchResponse,
  TaskManagementClient,
} from '../../api-client';
import { TaskManagementProjectOrchestrator } from '../project/project.orchestrator';
import { ProjectVM } from '../project/project.view-model';
import { IssueVM } from './issue.view-model';

/**
 * Orkiestrator zgłoszeń (`Issue` — nigdy `Task`, patrz
 * `docs/backend/task-management.md` §2).
 *
 * Projekt rozwiązuje się z sąsiedniego orkiestratora przez leniwe wstrzyknięcie `Injector`em —
 * ten sam wzorzec co `Product` → `Category` w Catalogu
 * (`docs/frontend/orchestrators.md` §2).
 */
@Injectable({ providedIn: 'root' })
export class TaskManagementIssueOrchestrator extends BaseOrchestrator<
  IssueDto,
  IssueVM,
  SearchIssueRequest,
  LoadOptions
> {
  private readonly _api = inject(TaskManagementClient);
  private readonly _injector = inject(Injector);
  private _projects: TaskManagementProjectOrchestrator | null = null;

  private get _projectSibling(): TaskManagementProjectOrchestrator {
    if (!this._projects) {
      this._projects = this._injector.get(TaskManagementProjectOrchestrator);
    }
    return this._projects;
  }

  protected override readonly signature = 'taskmgmt.issue';

  protected override readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string } = {
    signalrSignature: 'taskmgmt.issue',
    maxCacheSize: 1000,
  };

  protected override fetchByUuids(uuids: string[]): Observable<IssueDto[]> {
    return this._api.getIssue({ uuids } as GetIssueRequest);
  }

  protected override searchByFilters(filters: SearchIssueRequest): Observable<SearchResponse> {
    return this._api.searchIssue(filters);
  }

  protected override mapToViewModel(dto: IssueDto, resolvedDeps: ResolvedDeps): IssueVM {
    return { ...dto, project: resolvedDeps['project'] as ProjectVM | undefined };
  }

  protected override async resolveEagerDependencies(uuids: string[]): Promise<void> {
    const projectUuids = new Set<string>();

    for (const uuid of uuids) {
      const dto = this.identityMap.peek(uuid);
      if (dto?.projectUuid) {
        projectUuids.add(dto.projectUuid);
      }
    }

    if (projectUuids.size > 0) {
      await this._projectSibling.loadAsync([...projectUuids]);
    }
  }

  protected override _resolveCurrentDeps(dto: IssueDto): ResolvedDeps {
    return { project: dto.projectUuid ? this._projectSibling.getOne(dto.projectUuid)() : undefined };
  }

  /**
   * Zgłoszenie po kluczu czytelnym (`DEV-412`) — droga wejścia na kartę z linku w mailu.
   *
   * Odpowiedź trafia do wspólnego cache przez `loadAsync`, więc karta i lista widzą ten sam
   * obiekt i tak samo reagują na zdarzenie SignalR. Backend rozwiązuje też klucze historyczne
   * (`issue.previous_keys`), więc link sprzed przeniesienia projektu nadal działa.
   */
  public async loadByKeyAsync(key: string): Promise<IssueVM | undefined> {
    const dto = await this.runDirectCommandAsync(() => this._api.getIssueByKey({ key } as GetIssueByKeyRequest));

    if (!dto?.uuid) {
      return undefined;
    }

    // `{}` zamiast pominięcia opcji: `BaseOrchestrator.loadAsync` woła
    // `resolveEagerDependencies` WYŁĄCZNIE, gdy dostanie obiekt opcji — bez niego karta
    // wyświetliłaby sam kod projektu zamiast jego nazwy.
    await this.loadAsync([dto.uuid], {});
    return this.getOne(dto.uuid)();
  }

  // ── Komendy ──
  //
  // Każda mutacja idzie przez `BatchEndpointBase` — nawet zmiana tytułu jednego zgłoszenia jest
  // zadaniem z jednym elementem. Metody zwracają `jobUuid`, nie wynik operacji.

  /**
   * Zakłada zgłoszenie. `uuid` generuje klient (`crypto.randomUUID()`) i NADPISUJE cokolwiek
   * przyszło z formularza — tryb `Commands[]` wymaga identyfikatora w payloadzie.
   *
   * **Klucza czytelnego tu nie ma i być nie może**: nadaje go serwer z licznika projektu,
   * w tej samej transakcji co zapis (`docs/backend/task-management.md` §4).
   */
  public async createIssueAsync(command: IssueCreateCommand, queueId?: string): Promise<string> {
    const uuid = crypto.randomUUID();

    const jobUuid = await this.runSingleCommandAsync(
      (p) => this._api.issueCreateMultipleCommand(p),
      { ...command, uuid } as IssueCreateCommand,
      { commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.createIssue, queueId },
    );

    // Uuid jest znany od razu, zadanie kończy się asynchronicznie — ładujemy optymistycznie.
    // Jeśli zadanie odpadnie (np. na uprawnieniu), wpisu po prostu nie będzie w odpowiedzi.
    await this.loadAsync([uuid], {});
    return jobUuid;
  }

  public setTitleAsync(command: IssueSetTitleCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.issueSetTitleMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setIssueTitle,
      queueId,
    });
  }

  public setDescriptionAsync(command: IssueSetDescriptionCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.issueSetDescriptionMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setIssueDescription,
      queueId,
    });
  }

  public setDueDateAsync(command: IssueSetDueDateCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.issueSetDueDateMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setIssueDueDate,
      queueId,
    });
  }

  /**
   * Zmiana stanu jednego zgłoszenia — z karty, przyciskiem dostępnego przejścia.
   * Przejście spoza schematu odpada po stronie backendu jako `taskmgmt.transition_not_allowed`,
   * więc front nie musi (i nie powinien) duplikować tej reguły; wygaszenie niedostępnych
   * przycisków to wygoda, nie kontrola.
   */
  public setStateAsync(command: IssueSetStateCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.issueSetStateMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setIssueState,
      queueId,
    });
  }

  // ── Komendy wsadowe na zaznaczeniu z listy ──
  //
  // Cele buduje wywołujący przez `erpBuildBatchTargets(store.scope())`
  // (`docs/frontend/selection-scope.md` §3) — nigdy ręcznym składaniem `targetUuids`.

  public setStateMultipleAsync(
    payload: BatchCommandOfIssueSetStateCommandAndSearchIssueRequest,
    queueId?: string,
  ): Promise<string> {
    return this.runBatchCommandAsync((p) => this._api.issueSetStateMultipleCommand(p), payload, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setIssueState,
      queueId,
    });
  }

  public setAssigneeMultipleAsync(
    payload: BatchCommandOfIssueSetAssigneeCommandAndSearchIssueRequest,
    queueId?: string,
  ): Promise<string> {
    return this.runBatchCommandAsync((p) => this._api.issueSetAssigneeMultipleCommand(p), payload, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setIssueAssignee,
      queueId,
    });
  }

  public setPriorityMultipleAsync(
    payload: BatchCommandOfIssueSetPriorityCommandAndSearchIssueRequest,
    queueId?: string,
  ): Promise<string> {
    return this.runBatchCommandAsync((p) => this._api.issueSetPriorityMultipleCommand(p), payload, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setIssuePriority,
      queueId,
    });
  }
}
