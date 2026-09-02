import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { BaseOrchestrator, LoadOptions, OrchestratorConfig } from '@erp/shared/data-access';

import { SearchResponse, SearchWorkTypeRequest, TaskManagementClient, WorkTypeDto } from '../../api-client';
import { WorkTypeVM } from './work-type.view-model';

/**
 * Orkiestrator rodzajów pracy (TIME-001 AC2) — wzorem `TaskManagementTagOrchestrator`: słownik
 * jest mały (globalne plus własne projektu), więc uzupełnienie cache'u po uuid idzie przez
 * `searchWorkType` bez filtra projektu i lokalne dopasowanie.
 */
@Injectable({ providedIn: 'root' })
export class TaskManagementWorkTypeOrchestrator extends BaseOrchestrator<
  WorkTypeDto,
  WorkTypeVM,
  SearchWorkTypeRequest,
  LoadOptions
> {
  private readonly _api = inject(TaskManagementClient);

  protected override readonly signature = 'taskmgmt.work_type';

  protected override readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string } = {
    signalrSignature: 'taskmgmt.work_type',
    maxCacheSize: 1000,
  };

  protected override fetchByUuids(uuids: string[]): Observable<WorkTypeDto[]> {
    const wanted = new Set(uuids);

    return this._api
      .searchWorkType({} as SearchWorkTypeRequest)
      .pipe(map((types) => types.filter((type) => wanted.has(type.uuid))));
  }

  protected override searchByFilters(filters: SearchWorkTypeRequest): Observable<SearchResponse> {
    return this._api
      .searchWorkType(filters)
      .pipe(map((types) => ({ uuids: types.map((type) => type.uuid), totalCount: types.length }) as SearchResponse));
  }

  protected override mapToViewModel(dto: WorkTypeDto): WorkTypeVM {
    return dto;
  }

  /** Rodzaje pracy widoczne na projekcie (globalne plus jego własne) — używane przez picker
   * w formularzu wpisu czasu. Patrz `TaskManagementTagOrchestrator.searchTagsAsync` — ten sam
   * dwuetapowy zapis do identity mapy i natychmiastowe oznaczenie jako „załadowane". */
  public async searchWorkTypesAsync(request: SearchWorkTypeRequest): Promise<WorkTypeDto[]> {
    const types = await this.runDirectCommandAsync(() => this._api.searchWorkType(request));
    this.identityMap.setMany(types);
    await this.loadAsync(types.map((type) => type.uuid));
    return types;
  }
}
