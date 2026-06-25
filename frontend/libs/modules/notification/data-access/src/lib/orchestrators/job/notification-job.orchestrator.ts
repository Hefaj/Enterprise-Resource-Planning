import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { BaseOrchestrator, OrchestratorConfig, LoadOptions } from '@erp/shared/data-access';
import { NotificationBffClient, JobDto, SearchJobRequest, SearchResponse } from '../../api-client';
import { JobVM } from './job.view-model';

@Injectable({ providedIn: 'root' })
export class NotificationJobOrchestrator extends BaseOrchestrator<
  JobDto,
  JobVM,
  SearchJobRequest,
  LoadOptions
> {
  private readonly _api = inject(NotificationBffClient);

  protected override readonly signature = 'notification.job';

  protected override readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string } = {
    signalrSignature: 'notification.job',
    maxCacheSize: 500,
  };

  protected override fetchByUuids(uuids: string[]): Observable<JobDto[]> {
    return this._api.getJob({ uuids });
  }

  protected override searchByFilters(
    filters: SearchJobRequest,
  ): Observable<SearchResponse> {
    return this._api.searchJob(filters);
  }

  protected override mapToViewModel(
    dto: JobDto,
  ): JobVM {
    return {
      ...dto,
    };
  }
}
