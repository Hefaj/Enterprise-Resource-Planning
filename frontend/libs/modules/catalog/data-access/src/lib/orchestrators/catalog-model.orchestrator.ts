import { Injectable, inject } from '@angular/core';
import { BaseOrchestrator, AggregateStore } from '@erp/shared/data-access';
import { Observable } from 'rxjs';
import { CatalogBffClient, ModelDto, SearchModelRequest } from '../api-client';
import { ModelViewModel } from '@erp/catalog/util';


@Injectable({
  providedIn: 'root'
})
export class CatalogModelOrchestrator extends BaseOrchestrator<
  ModelDto,
  ModelViewModel,
  SearchModelRequest
> {
  static {
    AggregateStore.registerToken('CatalogModel', CatalogModelOrchestrator);
  }

  protected override get signature(): string { return 'CatalogModel'; }

  private readonly _api: CatalogBffClient = inject(CatalogBffClient);

  /**
   * Search models matching filters. Returns list of model UUIDs.
   */
  protected override fetchSearch(filters: SearchModelRequest): Observable<string[]> {
    return this._api.searchModel(filters);
  }

  /**
   * Fetch full Model DTOs matching the given list of UUIDs.
   */
  protected override fetchData(uuids: string[]): Observable<ModelDto[]> {
    return this._api.getModel({ uuids });
  }

  /**
   * Enrich Model DTO to View Model.
   */
  protected override enrich(dto: ModelDto): ModelViewModel {
    return {
      uuid: dto.uuid,
      name: dto['name'] || ''
    };
  }
}
