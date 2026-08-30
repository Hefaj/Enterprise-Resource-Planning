import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { BaseOrchestrator, LoadOptions, OrchestratorConfig } from '@erp/shared/data-access';

import {
  BatchCommandOfSprintSetIssueSprintCommandAndSearchIssueRequest,
  GetSprintRequest,
  SearchResponse,
  SearchSprintRequest,
  SprintCloseCommand,
  SprintCreateCommand,
  SprintDto,
  SprintSetIssueSprintCommand,
  SprintStartCommand,
  TaskManagementClient,
} from '../../api-client';

@Injectable({ providedIn: 'root' })
export class TaskManagementSprintOrchestrator extends BaseOrchestrator<SprintDto, SprintDto, SearchSprintRequest, LoadOptions> {
  private readonly _api = inject(TaskManagementClient);
  protected override readonly signature = 'taskmgmt.sprint';
  protected override readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string } = {
    signalrSignature: 'taskmgmt.sprint',
    maxCacheSize: 200,
  };
  protected override fetchByUuids(uuids: string[]): Observable<SprintDto[]> {
    return this._api.getSprint({ uuids } as GetSprintRequest);
  }
  protected override searchByFilters(filters: SearchSprintRequest): Observable<SearchResponse> {
    return this._api.searchSprint(filters);
  }
  protected override mapToViewModel(dto: SprintDto): SprintDto {
    return dto;
  }
  public setIssueSprintAsync(command: SprintSetIssueSprintCommand): Promise<string> {
    return this.runSingleCommandAsync((payload) => this._api.sprintSetIssueSprintMultipleCommand(payload), command, { commandName: 'shared.jobs.commands.taskmgmtSprintSetIssueSprint' });
  }
  public setIssuesSprintAsync(payload: BatchCommandOfSprintSetIssueSprintCommandAndSearchIssueRequest): Promise<string> {
    return this.runBatchCommandAsync((body) => this._api.sprintSetIssueSprintMultipleCommand(body), payload, { commandName: 'shared.jobs.commands.taskmgmtSprintSetIssueSprint' });
  }
  public createAsync(command: SprintCreateCommand): Promise<string> {
    return this.runSingleCommandAsync((payload) => this._api.sprintCreateMultipleCommand(payload), command, { commandName: 'shared.jobs.commands.taskmgmtSprintCreate' });
  }
  public startAsync(command: SprintStartCommand): Promise<string> {
    return this.runSingleCommandAsync((payload) => this._api.sprintStartMultipleCommand(payload), command, { commandName: 'shared.jobs.commands.taskmgmtSprintStart' });
  }
  public closeAsync(command: SprintCloseCommand): Promise<string> {
    return this.runSingleCommandAsync((payload) => this._api.sprintCloseMultipleCommand(payload), command, { commandName: 'shared.jobs.commands.taskmgmtSprintClose' });
  }
}
