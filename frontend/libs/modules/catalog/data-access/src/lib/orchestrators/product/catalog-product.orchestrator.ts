import { Injectable, inject, Injector } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BaseOrchestrator, OrchestratorConfig, ResolvedDeps } from '@erp/shared/data-access';
import { CatalogBffClient, ProductDto, SearchProductRequest, SearchResponse, BatchCommandOfProductSetPriceCommand, BatchResult } from '../../api-client';
import { ProductVM, CatalogProductLoadOptions } from './product.view-model';
import { CategoryVM } from '../category/category.view-model';
import { ModelVM } from '../model/model.view-model';
import { CatalogCategoryOrchestrator } from '../category/catalog-category.orchestrator';
import { CatalogModelOrchestrator } from '../model/catalog-model.orchestrator';

/**
 * Resolved dependencies shape for Product ViewModel mapping.
 */
interface ProductResolvedDeps extends ResolvedDeps {
  categories: CategoryVM[];
  model: ModelVM | null;
}

/**
 * Orchestrator for the Product aggregate in the Catalog module.
 *
 * This is the most complex orchestrator, demonstrating:
 * - **Lazy injection** of sibling orchestrators via `Injector` to avoid circular DI
 * - **Eager loading** of categories and models based on `LoadOptions`
 * - **DTO → ViewModel mapping** that resolves `categoryUuids` and `modelUuid`
 *   to rich nested objects
 */
@Injectable({ providedIn: 'root' })
export class CatalogProductOrchestrator extends BaseOrchestrator<
  ProductDto,
  ProductVM,
  SearchProductRequest,
  CatalogProductLoadOptions
> {
  private readonly _api = inject(CatalogBffClient);
  private readonly _injector = inject(Injector);

  // Lazy-loaded sibling orchestrators to break circular dependency
  private _categoryOrchestrator: CatalogCategoryOrchestrator | null = null;
  private _modelOrchestrator: CatalogModelOrchestrator | null = null;

  protected override readonly signature = 'catalog.product';

  protected override readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string } = {
    signalrSignature: 'catalog.product',
    // Products are the heaviest aggregate — max cache
    maxCacheSize: 1000,
    maxChunkSize: 100,
    bufferTimeMs: 50,
  };

  // ────────────────────────────────────────────────────────────────
  // Lazy Injection (Circular Dependency Prevention)
  // ────────────────────────────────────────────────────────────────

  private get _categorySiblingOrchestrator(): CatalogCategoryOrchestrator {
    if (!this._categoryOrchestrator) {
      this._categoryOrchestrator = this._injector.get(CatalogCategoryOrchestrator);
    }
    return this._categoryOrchestrator;
  }

  private get _modelSiblingOrchestrator(): CatalogModelOrchestrator {
    if (!this._modelOrchestrator) {
      this._modelOrchestrator = this._injector.get(CatalogModelOrchestrator);
    }
    return this._modelOrchestrator;
  }

  // ────────────────────────────────────────────────────────────────
  // Abstract implementations
  // ────────────────────────────────────────────────────────────────

  protected override fetchByUuids(uuids: string[]): Observable<ProductDto[]> {
    return this._api.getProduct({ uuids });
  }

  protected override searchByFilters(
    filters: SearchProductRequest,
  ): Observable<SearchResponse> {
    return this._api.searchProduct(filters);
  }

  protected override mapToViewModel(
    dto: ProductDto,
    resolvedDeps: ResolvedDeps,
  ): ProductVM {
    const deps = resolvedDeps as ProductResolvedDeps;

    return {
      ...dto,
      categories: deps.categories ?? [],
      model: deps.model ?? null,
    };
  }

  // ────────────────────────────────────────────────────────────────
  // Eager Loading: Resolve Product Dependencies
  // ────────────────────────────────────────────────────────────────

  /**
   * After loading products, eagerly load their categories and models.
   *
   * 1. Collect all unique `categoryUuids` and `modelUuid` from loaded products
   * 2. Delegate to the respective sibling orchestrators
   * 3. Products are considered "ready" only when all dependencies resolve
   */
  protected override async resolveEagerDependencies(
    uuids: string[],
    options: CatalogProductLoadOptions,
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    // Collect referenced UUIDs from loaded products
    const categoryUuids = new Set<string>();
    const modelUuids = new Set<string>();

    for (const uuid of uuids) {
      const dto = this.identityMap.peek(uuid);
      if (!dto) continue;

      if (options.includeCategories && dto.categoryUuids) {
        for (const catUuid of dto.categoryUuids) {
          categoryUuids.add(catUuid);
        }
      }

      if (options.includeModel && dto.modelUuid) {
        modelUuids.add(dto.modelUuid);
      }
    }

    // Delegate to sibling orchestrators
    if (categoryUuids.size > 0) {
      promises.push(
        this._categorySiblingOrchestrator.loadAsync([...categoryUuids], { includeParent: true }),
      );
    }

    if (modelUuids.size > 0) {
      promises.push(
        this._modelSiblingOrchestrator.loadAsync([...modelUuids]),
      );
    }

    await Promise.all(promises);
  }

  /**
   * Resolve current dependencies for a single product DTO.
   * Called synchronously during Signal/computed evaluation.
   * Uses already-cached data from sibling orchestrators.
   */
  protected override _resolveCurrentDeps(dto: ProductDto): ProductResolvedDeps {
    // Resolve categories from the category orchestrator's cache
    const categories: CategoryVM[] = dto.categoryUuids
      ? this._categorySiblingOrchestrator.resolveCategoryVMs(dto.categoryUuids)
      : [];

    // Resolve model from the model orchestrator's cache
    let model: ModelVM | null = null;
    if (dto.modelUuid) {
      const modelDto = this._modelSiblingOrchestrator['identityMap'].peek(dto.modelUuid);
      if (modelDto) {
        model = { ...modelDto };
      }
    }

    return { categories, model };
  }

  /**
   * Execute batch command to update price for selected products.
   */
  public async setPriceMultiple(
    command: BatchCommandOfProductSetPriceCommand,
    queueID?: string,
  ): Promise<string> {
    const apiCall = () => this._api.productSetPriceMultipleCommand(command).pipe(
      map((res: BatchResult) => res.jobUuid || '')
    );
    return this.executeCommand(
      'Ustawianie cen produktów',
      apiCall,
      undefined,
      queueID
    );
  }
}
