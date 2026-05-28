import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { BaseOrchestrator, OrchestratorConfig, Pagination, ResolvedDeps, LoadOptions } from '@erp/shared/data-access';
import { CatalogBffClient, CategoryDto, SearchCategoryRequest } from '../../api-client';
import { CategoryVM } from './category.view-model';

/**
 * Maximum depth for resolving parent category chains.
 * Prevents infinite recursion when categories form deep hierarchies.
 */
const MAX_PARENT_DEPTH = 3;

/**
 * Orchestrator for the Category aggregate in the Catalog module.
 *
 * Handles self-referential `parentUuid` resolution with max-depth guard.
 * When a CategoryDto has a `parentUuid`, the orchestrator resolves it
 * to a nested `CategoryVM.parent` object — up to MAX_PARENT_DEPTH levels.
 */
@Injectable({ providedIn: 'root' })
export class CatalogCategoryOrchestrator extends BaseOrchestrator<
  CategoryDto,
  CategoryVM,
  SearchCategoryRequest,
  LoadOptions
> {
  private readonly _api = inject(CatalogBffClient);

  protected override readonly signature = 'catalog.category';

  protected override readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string } = {
    signalrSignature: 'catalog.category',
    maxCacheSize: 500, // Categories are typically fewer than products
  };

  // ────────────────────────────────────────────────────────────────
  // Abstract implementations
  // ────────────────────────────────────────────────────────────────

  protected override fetchByUuids(uuids: string[]): Observable<CategoryDto[]> {
    return this._api.getCategory({ uuids });
  }

  protected override searchByFilters(
    filters: SearchCategoryRequest,
    _pagination?: Pagination,
  ): Observable<string[]> {
    return this._api.searchCategory(filters);
  }

  protected override mapToViewModel(dto: CategoryDto, _resolvedDeps: ResolvedDeps): CategoryVM {
    return this._mapWithDepthGuard(dto, 0);
  }

  // ────────────────────────────────────────────────────────────────
  // Eager Loading: Resolve parent chain
  // ────────────────────────────────────────────────────────────────

  /**
   * After loading categories, eagerly load their parent chain
   * up to MAX_PARENT_DEPTH levels.
   */
  protected override async resolveEagerDependencies(
    uuids: string[],
    _options: LoadOptions,
  ): Promise<void> {
    await this._loadParentChain(uuids, 0);
  }

  /**
   * Recursively load parent categories up to max depth.
   */
  private async _loadParentChain(uuids: string[], depth: number): Promise<void> {
    if (depth >= MAX_PARENT_DEPTH) return;

    // Collect all parentUuids from currently loaded categories
    const parentUuids = new Set<string>();
    for (const uuid of uuids) {
      const dto = this.identityMap.peek(uuid);
      if (dto?.parentUuid) {
        parentUuids.add(dto.parentUuid);
      }
    }

    if (parentUuids.size === 0) return;

    // Load parents
    const missingParents = [...parentUuids].filter(uuid => !this.identityMap.has(uuid));
    if (missingParents.length > 0) {
      await this.dataLoader.loadAsync(missingParents);
    }

    // Recurse for the next level
    await this._loadParentChain([...parentUuids], depth + 1);
  }

  // ────────────────────────────────────────────────────────────────
  // Internal: Recursive DTO → VM mapping with depth guard
  // ────────────────────────────────────────────────────────────────

  private _mapWithDepthGuard(dto: CategoryDto, depth: number): CategoryVM {
    let parent: CategoryVM | null = null;

    if (dto.parentUuid && depth < MAX_PARENT_DEPTH) {
      const parentDto = this.identityMap.peek(dto.parentUuid);
      if (parentDto) {
        parent = this._mapWithDepthGuard(parentDto, depth + 1);
      }
    }

    return {
      ...dto,
      parent,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // Public: Convenience method for external orchestrators
  // ────────────────────────────────────────────────────────────────

  /**
   * Resolve a list of category UUIDs to CategoryVM objects.
   * Used by CatalogProductOrchestrator to populate Product.categories.
   * Returns only categories that are already cached.
   */
  public resolveCategoryVMs(uuids: string[]): CategoryVM[] {
    const result: CategoryVM[] = [];
    for (const uuid of uuids) {
      const dto = this.identityMap.peek(uuid);
      if (dto) {
        result.push(this._mapWithDepthGuard(dto, 0));
      }
    }
    return result;
  }
}
