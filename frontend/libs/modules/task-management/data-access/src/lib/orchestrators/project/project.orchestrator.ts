import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { BaseOrchestrator, LoadOptions, OrchestratorConfig } from '@erp/shared/data-access';
import { TASK_MANAGEMENT_JOB_COMMAND_KEYS } from '@erp/task-management/util';

import {
  GetProjectRequest,
  ProjectDto,
  ProjectAddMemberCommand,
  ProjectRemoveMemberCommand,
  ProjectSetFieldSchemeCommand,
  ProjectSetSlaPolicyCommand,
  ProjectSetWorkflowSchemeCommand,
  SearchProjectRequest,
  SearchResponse,
  TaskManagementClient,
} from '../../api-client';
import { ProjectVM } from './project.view-model';

/**
 * Orkiestrator projektów. Projekt jest **kontekstem listy zgłoszeń**, nie osobną stroną
 * (`docs/frontend/task-management-pages.md` §1), więc jego głównym konsumentem jest przełącznik
 * kontekstu nad tabelą, a nie własny ekran.
 *
 * Cache jest mały i celowo bez paginacji po stronie konsumenta: projektów są dziesiątki,
 * nie dziesiątki tysięcy — to ta sama różnica skali, która w
 * [`task-management.md` §10.1](../../../../../../../docs/backend/task-management.md) pozwoliła
 * liczyć widoczność joinem zamiast materializowanym ACL.
 */
@Injectable({ providedIn: 'root' })
export class TaskManagementProjectOrchestrator extends BaseOrchestrator<
  ProjectDto,
  ProjectVM,
  SearchProjectRequest,
  LoadOptions
> {
  private readonly _api = inject(TaskManagementClient);

  protected override readonly signature = 'taskmgmt.project';

  protected override readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string } = {
    signalrSignature: 'taskmgmt.project',
    maxCacheSize: 200,
  };

  protected override fetchByUuids(uuids: string[]): Observable<ProjectDto[]> {
    return this._api.getProject({ uuids } as GetProjectRequest);
  }

  protected override searchByFilters(filters: SearchProjectRequest): Observable<SearchResponse> {
    return this._api.searchProject(filters);
  }

  protected override mapToViewModel(dto: ProjectDto): ProjectVM {
    return dto;
  }

  /**
   * Podpina albo odpina schemat pól niestandardowych.
   *
   * <p>Pusty <c>fieldSchemeUuid</c> odpina schemat i <b>nie kasuje</b> wartości zapisanych
   * na zgłoszeniach — wracają, gdy schemat wróci. Kasowanie danych przy zmianie konfiguracji
   * jest nieodwracalne, a ta operacja nie wygląda na nieodwracalną
   * (`docs/backend/task-management.md` §6).</p>
   */
  public setFieldSchemeAsync(command: ProjectSetFieldSchemeCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.projectSetFieldSchemeMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setProjectFieldScheme,
      queueId,
    });
  }

  /**
   * Przestawia projekt na inny automat stanów.
   *
   * <p><b>Migracji zgłoszeń ta metoda nie robi</b> — zgodnie z tym samym układem, co publikacja
   * schematu (`docs/backend/task-management.md` §5.3): komenda sprawdza kompletność mapowania
   * i przestawia projekt, a doprowadzenie zgłoszeń do stanów nowego schematu idzie osobnym
   * zadaniem masowym, zleconym po jej powodzeniu.</p>
   */
  public setWorkflowSchemeAsync(command: ProjectSetWorkflowSchemeCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.projectSetWorkflowSchemeMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setProjectWorkflowScheme,
      queueId,
    });
  }

  /** Dodaje członka projektu albo zmienia jego rolę — komenda jest idempotentna po użytkowniku. */
  public addMemberAsync(command: ProjectAddMemberCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.projectAddMemberMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.addProjectMember,
      queueId,
    });
  }

  /** Odbiera członkostwo. Nie rusza zgłoszeń przypisanych tej osobie — członkostwo jest
   * atrybutem widoczności, nie właścicielstwem pracy. */
  public removeMemberAsync(command: ProjectRemoveMemberCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.projectRemoveMemberMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.removeProjectMember,
      queueId,
    });
  }

  /** Ustawia terminy SLA projektu; puste obie wartości usuwają politykę. */
  public setSlaPolicyAsync(command: ProjectSetSlaPolicyCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.projectSetSlaPolicyMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setProjectSlaPolicy,
      queueId,
    });
  }
}
