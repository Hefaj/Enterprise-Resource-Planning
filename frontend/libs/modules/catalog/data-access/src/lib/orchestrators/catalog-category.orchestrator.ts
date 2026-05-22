import { Injectable } from '@angular/core';
import { BaseDto, BaseOrchestrator, AggregateStore } from '@erp/shared/data-access';
import { Observable, of } from 'rxjs';
import { CategoryViewModel } from '@erp/catalog/util';

export interface CategoryDto extends BaseDto {
  uuid: string;
  name: string;
  parentUuid?: string;
}


@Injectable({
  providedIn: 'root'
})
export class CatalogCategoryOrchestrator extends BaseOrchestrator<CategoryDto, CategoryViewModel> {
  static {
    AggregateStore.registerToken('CatalogCategory', CatalogCategoryOrchestrator);
  }

  protected override get signature(): string { return 'CatalogCategory'; }

  /**
   * Mock search: returns category UUIDs.
   */
  protected override fetchSearch(): Observable<string[]> {
    return of(['cat-electronics', 'cat-laptops', 'cat-smartphones']);
  }

  /**
   * Mock get/fetch: returns category DTOs by UUIDs.
   */
  protected override fetchData(uuids: string[]): Observable<CategoryDto[]> {
    const mockCategories: CategoryDto[] = [
      { uuid: 'cat-electronics', name: 'Electronics' },
      { uuid: 'cat-laptops', name: 'Laptops', parentUuid: 'cat-electronics' },
      { uuid: 'cat-smartphones', name: 'Smartphones', parentUuid: 'cat-electronics' }
    ];
    return of(mockCategories.filter(c => uuids.includes(c.uuid)));
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
