import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { BaseOrchestrator, OrchestratorConfig, ResolvedDeps, LoadOptions } from '@erp/shared/data-access';
import { CatalogBffClient, ModelDto, SearchModelRequest, SearchResponse } from '../../api-client';
import { ModelVM } from './model.view-model';

/**
 * Orchestrator for the Model aggregate in the Catalog module.
 *
 * This is the simplest orchestrator — ModelDto has no references
 * to other aggregates, so `mapToViewModel` is a 1:1 mapping.
 */
@Injectable({ providedIn: 'root' })
export class CatalogModelOrchestrator extends BaseOrchestrator<
  ModelDto,
  ModelVM,
  SearchModelRequest,
  LoadOptions
> {
  private readonly _api = inject(CatalogBffClient);

  protected override readonly signature = 'catalog.model';

  protected override readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string } = {
    signalrSignature: 'catalog.model',
    maxCacheSize: 500, // Models are typically fewer than products
  };

  // ────────────────────────────────────────────────────────────────
  // Abstract implementations
  // ────────────────────────────────────────────────────────────────

  protected override fetchByUuids(uuids: string[]): Observable<ModelDto[]> {
    return this._api.getModel({ uuids });
  }

  protected override searchByFilters(
    filters: SearchModelRequest,
  ): Observable<SearchResponse> {
    return this._api.searchModel(filters);
  }

  protected override mapToViewModel(dto: ModelDto, _resolvedDeps: ResolvedDeps): ModelVM {
    return {
      ...dto
    };
  }
}
