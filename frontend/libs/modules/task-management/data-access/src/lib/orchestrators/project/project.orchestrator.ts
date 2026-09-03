import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { BaseOrchestrator, LoadOptions, OrchestratorConfig } from '@erp/shared/data-access';
import { TASK_MANAGEMENT_JOB_COMMAND_KEYS } from '@erp/task-management/util';

import {
  GetProjectRequest,
  ProjectDto,
  ProjectSetArchivedCommand,
  ProjectSetCodeCommand,
  ProjectSetDefaultSavedViewCommand,
  ProjectSetFieldSchemeCommand,
  ProjectSetIssueTypeSchemeCommand,
  ProjectSetSlaCommand,
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

  /** Podpina schemat typów zgłoszeń (`TYP-001`) — każdy projekt musi mieć jeden, domyślnie
   * systemowy z seeda. Zakładka „typy" karty projektu jest jedynym miejscem, które to wywołuje. */
  public setIssueTypeSchemeAsync(command: ProjectSetIssueTypeSchemeCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.projectSetIssueTypeSchemeMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setProjectIssueTypeScheme,
      queueId,
    });
  }

  /** Zapisuje politykę SLA projektu (`SLA-001`, faza 5) — czas reakcji/realizacji i kalendarz
   * roboczy minimalny (dni + godziny, bez świąt na start). */
  public setSlaAsync(command: ProjectSetSlaCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.projectSetSlaMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setProjectSla,
      queueId,
    });
  }

  /** Zmienia prefiks klucza (PRJ-003) — istniejące zgłoszenia zachowują swój klucz. */
  public setCodeAsync(command: ProjectSetCodeCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.projectSetCodeMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setProjectCode,
      queueId,
    });
  }

  /** Archiwizuje/przywraca projekt (PRJ-004) — bez komendy usuwania, projektu się nie kasuje. */
  public setArchivedAsync(command: ProjectSetArchivedCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.projectSetArchivedMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setProjectArchived,
      queueId,
    });
  }

  /** Ustawia/zdejmuje widok domyślny projektu (VIEW-002) — musi być widokiem udostępnionym
   * TEMU projektowi, backend odrzuca widok prywatny albo należący do innego projektu. */
  public setDefaultSavedViewAsync(command: ProjectSetDefaultSavedViewCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.projectSetDefaultSavedViewMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setProjectDefaultSavedView,
      queueId,
    });
  }
}
