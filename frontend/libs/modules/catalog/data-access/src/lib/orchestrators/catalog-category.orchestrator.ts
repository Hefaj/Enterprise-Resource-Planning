import { Injectable, inject } from '@angular/core';
import { BaseOrchestrator, AggregateStore } from '@erp/shared/data-access';
import { Observable } from 'rxjs';
import { CategoryViewModel } from '@erp/catalog/util';
import { CatalogBffClient, CategoryDto, SearchCategoryRequest } from '../api-client';


@Injectable({
  providedIn: 'root'
})
export class CatalogCategoryOrchestrator extends BaseOrchestrator<
  CategoryDto,
  CategoryViewModel,
  SearchCategoryRequest
> {
  static {
    AggregateStore.registerToken('CatalogCategory', CatalogCategoryOrchestrator);
  }

  protected override get signature(): string { return 'CatalogCategory'; }

  private readonly _api = inject(CatalogBffClient);

  /**
   * Search categories matching filters. Returns list of category UUIDs.
   */
  protected override fetchSearch(filters: SearchCategoryRequest): Observable<string[]> {
    return this._api.searchCategory(filters);
  }

  /**
   * Fetch category DTOs by UUIDs.
   */
  protected override fetchData(uuids: string[]): Observable<CategoryDto[]> {
    return this._api.getCategory({ uuids });
  }

  /**
   * Enrich category DTO to View Model.
   * Resolves its parent hierarchy reactively by querying the raw DTO cache recursively,
   * avoiding circular computed signal dependencies.
   */
  protected override enrich(dto: CategoryDto): CategoryViewModel {
    const cache = this.cacheSignal();

    const buildParentVm = (parentUuid: string, visited: Set<string>): CategoryViewModel | undefined => {
      if (visited.has(parentUuid)) {
        console.warn(`[CatalogCategoryOrchestrator] Circular category dependency detected for UUID: ${parentUuid}`);
        return undefined;
      }
      const parentDto = cache.get(parentUuid);
      if (!parentDto) {
        return undefined;
      }
      visited.add(parentUuid);
      return {
        uuid: parentDto.uuid,
        name: parentDto.name,
        parent: parentDto.parentUuid ? buildParentVm(parentDto.parentUuid, visited) : undefined
      };
    };

    return {
      uuid: dto.uuid,
      name: dto.name,
      parent: dto.parentUuid ? buildParentVm(dto.parentUuid, new Set([dto.uuid])) : undefined
    };
  }

  /**
   * Resolves parent dependencies recursively: if loaded categories have parent category uuids
   * that are not yet loaded, we request them to be loaded.
   */
  protected override resolveDependencies(dtos: CategoryDto[]): Observable<unknown>[] {
    const parentUuids = dtos
      .map(d => d.parentUuid)
      .filter((uuid): uuid is string => !!uuid && !this.cacheSignal().has(uuid));

    if (parentUuids.length > 0) {
      return [this.load(parentUuids)];
    }
    return [];
  }
}
