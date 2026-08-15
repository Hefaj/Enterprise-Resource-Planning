import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { BaseOrchestrator, OrchestratorConfig, LoadOptions } from '@erp/shared/data-access';
import { NOTIFICATION_JOB_SIGNATURE } from '@erp/notification/util';
import { NotificationClient, JobDto, SearchJobRequest, SearchResponse } from '../../api-client';
import { JobVM, mapJobDtoToRecord } from './job.view-model';

@Injectable({ providedIn: 'root' })
export class NotificationJobOrchestrator extends BaseOrchestrator<
  JobDto,
  JobVM,
  SearchJobRequest,
  LoadOptions
> {
  private readonly _api = inject(NotificationClient);

  // Gettery, nie pola — patrz uzasadnienie przy CatalogMultimediaOrchestrator
  // (frontend/libs/modules/catalog/data-access/.../catalog-multimedia.orchestrator.ts).
  protected override get signature(): string {
    return NOTIFICATION_JOB_SIGNATURE;
  }

  protected override get orchestratorConfig(): Partial<OrchestratorConfig> & { signalrSignature: string } {
    return {
      signalrSignature: NOTIFICATION_JOB_SIGNATURE,
      maxCacheSize: 500,
    };
  }

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
    return mapJobDtoToRecord(dto);
  }
}
