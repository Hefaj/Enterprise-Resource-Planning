import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of } from 'rxjs';

import { BaseOrchestrator, LoadOptions, OrchestratorConfig } from '@erp/shared/data-access';
import { TASK_MANAGEMENT_JOB_COMMAND_KEYS } from '@erp/task-management/util';

import {
  GetSprintRequest,
  SearchResponse,
  SearchSprintRequest,
  SprintCreateCommand,
  SprintDto,
  SprintExecCloseCommand,
  SprintExecStartCommand,
  SprintSetDatesCommand,
  TaskManagementClient,
} from '../../api-client';
import { SprintVM } from './sprint.view-model';

/**
 * Orkiestrator sprintów.
 *
 * <p><c>getSprint</c> niesie pojedynczy uuid (żaden ekran nie odpytuje o dziesiątki sprintów
 * naraz — jest ich góra kilka na tablicę), więc uzupełnienie brakujących wpisów w cache’u idzie
 * przez kilka równoległych żądań, a nie przez wariant wsadowy jak przy projektach czy
 * zgłoszeniach.</p>
 */
@Injectable({ providedIn: 'root' })
export class TaskManagementSprintOrchestrator extends BaseOrchestrator<
  SprintDto,
  SprintVM,
  SearchSprintRequest,
  LoadOptions
> {
  private readonly _api = inject(TaskManagementClient);

  protected override readonly signature = 'taskmgmt.sprint';

  protected override readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string } = {
    signalrSignature: 'taskmgmt.sprint',
    maxCacheSize: 500,
  };

  protected override fetchByUuids(uuids: string[]): Observable<SprintDto[]> {
    if (uuids.length === 0) {
      return of([]);
    }

    return forkJoin(uuids.map((uuid) => this._api.getSprint({ uuid } as GetSprintRequest)));
  }

  protected override searchByFilters(filters: SearchSprintRequest): Observable<SearchResponse> {
    return this._api
      .searchSprint(filters)
      .pipe(map((sprints) => ({ uuids: sprints.map((sprint) => sprint.uuid), totalCount: sprints.length }) as SearchResponse));
  }

  protected override mapToViewModel(dto: SprintDto): SprintVM {
    return dto;
  }

  /**
   * Sprinty widoczne dla użytkownika na wskazanej tablicy, w kolejności planu.
   *
   * <p>Zapisuje wynik do identity mapy I OD RAZU oznacza te uuid jako „załadowane"
   * (`loadAsync` — bez sieciowego pobrania, bo `getMissing` widzi je już w cache'u): inaczej
   * `getViewModel()` nigdy by ich nie pokazał, bo filtruje po zbiorze uuid przekazanych
   * kiedyś do `loadAsync`, nie po samej zawartości identity mapy. Bez tej poprawki backlog
   * (`BacklogStore.sprints`) świecił pustką mimo poprawnej odpowiedzi z `searchSprint`.</p>
   */
  public async searchSprintsAsync(request: SearchSprintRequest): Promise<SprintDto[]> {
    const sprints = await this.runDirectCommandAsync(() => this._api.searchSprint(request));
    this.identityMap.setMany(sprints);
    await this.loadAsync(sprints.map((sprint) => sprint.uuid));
    return sprints;
  }

  public createMultipleAsync(command: SprintCreateCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.sprintCreateMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.createSprint,
      queueId,
    });
  }

  public setDatesMultipleAsync(command: SprintSetDatesCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.sprintSetDatesMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setSprintDates,
      queueId,
    });
  }

  public execStartMultipleAsync(command: SprintExecStartCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.sprintExecStartMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.execStartSprint,
      queueId,
    });
  }

  public execCloseMultipleAsync(command: SprintExecCloseCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.sprintExecCloseMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.execCloseSprint,
      queueId,
    });
  }
}
