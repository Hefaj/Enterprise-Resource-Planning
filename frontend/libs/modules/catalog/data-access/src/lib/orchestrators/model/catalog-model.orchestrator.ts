import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { BaseOrchestrator, OrchestratorConfig, ResolvedDeps, LoadOptions } from '@erp/shared/data-access';
import { CatalogBffClient, ModelDto, SearchModelRequest, SearchResponse } from '../../api-client';
import { ModelVM } from './model.view-model';

/**
 * Orkiestrator dla agregatu modelu (Model) w module Catalog.
 *
 * To jest najprostszy orkiestrator — ModelDto nie posiada referencji
 * do innych agregatów, więc mapToViewModel to mapowanie 1:1.
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
    maxCacheSize: 500, // Modele są zazwyczaj mniej liczne niż produkty
  };

  // ────────────────────────────────────────────────────────────────
  // Abstrakcyjne implementacje
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
