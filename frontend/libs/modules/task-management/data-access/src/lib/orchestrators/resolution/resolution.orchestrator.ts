import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { BaseOrchestrator, LoadOptions, OrchestratorConfig } from '@erp/shared/data-access';
import { TASK_MANAGEMENT_JOB_COMMAND_KEYS } from '@erp/task-management/util';

import {
  ResolutionCreateCommand,
  ResolutionDto,
  SearchResolutionRequest,
  SearchResponse,
  TaskManagementClient,
} from '../../api-client';
import { ResolutionVM } from './resolution.view-model';

/**
 * Orkiestrator rozwiązań (ISS-007).
 *
 * <p>Bez <c>getResolution</c> — wzorem <see cref="TaskManagementTagOrchestrator" />, słownik
 * jest mały (cztery systemowe plus ewentualne własne projektu).</p>
 */
@Injectable({ providedIn: 'root' })
export class TaskManagementResolutionOrchestrator extends BaseOrchestrator<
  ResolutionDto,
  ResolutionVM,
  SearchResolutionRequest,
  LoadOptions
> {
  private readonly _api = inject(TaskManagementClient);

  protected override readonly signature = 'taskmgmt.resolution';

  protected override readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string } = {
    signalrSignature: 'taskmgmt.resolution',
    maxCacheSize: 500,
  };

  protected override fetchByUuids(uuids: string[]): Observable<ResolutionDto[]> {
    const wanted = new Set(uuids);

    return this._api
      .searchResolution({} as SearchResolutionRequest)
      .pipe(map((resolutions) => resolutions.filter((resolution) => wanted.has(resolution.uuid))));
  }

  protected override searchByFilters(filters: SearchResolutionRequest): Observable<SearchResponse> {
    return this._api
      .searchResolution(filters)
      .pipe(
        map(
          (resolutions) =>
            ({ uuids: resolutions.map((resolution) => resolution.uuid), totalCount: resolutions.length }) as SearchResponse,
        ),
      );
  }

  protected override mapToViewModel(dto: ResolutionDto): ResolutionVM {
    return dto;
  }

  /**
   * Rozwiązania widoczne na projekcie (systemowe plus jego własne) — picker w modalu WF-004.
   *
   * <p>Wzorem `TaskManagementTagOrchestrator.searchTagsAsync` — patrz komentarz tam po
   * uzasadnienie dodatkowego `loadAsync`.</p>
   */
  public async searchResolutionsAsync(request: SearchResolutionRequest): Promise<ResolutionDto[]> {
    const resolutions = await this.runDirectCommandAsync(() => this._api.searchResolution(request));
    this.identityMap.setMany(resolutions);
    await this.loadAsync(resolutions.map((resolution) => resolution.uuid));
    return resolutions;
  }

  public createMultipleAsync(command: ResolutionCreateCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.resolutionCreateMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.createResolution,
      queueId,
    });
  }
}
