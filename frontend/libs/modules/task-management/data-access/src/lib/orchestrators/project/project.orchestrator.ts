import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { BaseOrchestrator, LoadOptions, OrchestratorConfig } from '@erp/shared/data-access';

import {
  GetProjectRequest,
  ProjectDto,
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
}
