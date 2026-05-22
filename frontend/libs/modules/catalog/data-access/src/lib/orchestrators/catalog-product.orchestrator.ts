import { Injectable, inject } from '@angular/core';
import { BaseOrchestrator, BaseDto, AggregateStore } from '@erp/shared/data-access';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { CatalogBffClient, ProductDto, SearchProductRequest } from '../api-client';
import { ProductViewModel, CategoryViewModel, ModelViewModel } from '@erp/catalog/util';
import { CatalogCategoryOrchestrator } from './catalog-category.orchestrator';
import { CatalogModelOrchestrator } from './catalog-model.orchestrator';

// Define the loaded options for Product aggregate
export interface ProductLoadOptions {
  includeCategory?: boolean;
  includeModel?: boolean;
}


@Injectable({
  providedIn: 'root'
})
export class CatalogProductOrchestrator extends BaseOrchestrator<
  ProductDto,
  ProductViewModel,
  SearchProductRequest,
  ProductLoadOptions
> {
  static {
    AggregateStore.registerToken('CatalogProduct', CatalogProductOrchestrator);
    AggregateStore.registerToken('CatalogCategory', CatalogCategoryOrchestrator);
    AggregateStore.registerToken('CatalogModel', CatalogModelOrchestrator);
  }

  protected override get signature(): string { return 'CatalogProduct'; }

  private readonly _api = inject(CatalogBffClient);

  /**
   * Search products matching filters. Returns list of product UUIDs.
   */
  protected override fetchSearch(filters: SearchProductRequest): Observable<string[]> {
    return this._api.searchProduct(filters);
  }

  /**
   * Fetch full Product DTOs matching the given list of UUIDs.
   */
  protected override fetchData(uuids: string[]): Observable<ProductDto[]> {
    return this._api.getProduct({ uuids });
  }

  /**
   * Enrich Product DTO to ProductViewModel.
   * Resolves Category and Model dependencies reactively using Angular Signals.
   */
  protected override enrich(dto: ProductDto): ProductViewModel {
    const categoryOrchestrator = this.store.getOrchestrator<BaseOrchestrator<BaseDto, CategoryViewModel>>('CatalogCategory');
    const modelOrchestrator = this.store.getOrchestrator<BaseOrchestrator<BaseDto, ModelViewModel>>('CatalogModel');

    const categoryVms = categoryOrchestrator.allViewModels();
    const modelVms = modelOrchestrator.allViewModels();

    const categoryUuids: string[] = dto['categoryUuids'] || [];
    const modelUuid: string | undefined = dto['modelUuid'];

    const categories = categoryUuids
      .map(uuid => categoryVms.get(uuid))
      .filter((cat): cat is CategoryViewModel => !!cat);

    const model = modelUuid ? modelVms.get(modelUuid) : undefined;

    const sku = dto['sku'] || '';
    const price = dto['price'] || 0;
    const availableFrom = dto['availableFrom'] ? new Date(dto['availableFrom']) : undefined;
    const status = dto['status'] || '';
    const available = dto['available'] ?? false;
    const ean = dto['ean'] || '';
    const image = dto['image'] || null;

    // Gather dynamic attributes (attr_*)
    const dynamicAttrs: Record<string, unknown> = {};
    for (const key of Object.keys(dto)) {
      if (key.startsWith('attr_')) {
        dynamicAttrs[key] = dto[key];
      }
    }

    return {
      uuid: dto.uuid,
      name: dto['name'] || '',
      categoryUuids,
      modelUuid,
      categories,
      model,
      sku,
      price,
      availableFrom,
      status,
      available,
      ean,
      image,
      category: categories.map(c => c.name).join(', '),
      modelName: model?.name || '',
      ...dynamicAttrs
    };
  }

  /**
   * Post-fetch dependency resolution. Decides what child aggregates to pre-fetch.
   */
  protected override resolveDependencies(dtos: ProductDto[], options?: ProductLoadOptions): Observable<unknown>[] {
    const deps: Observable<unknown>[] = [];
    const categoryOrchestrator = this.store.getOrchestrator<BaseOrchestrator<BaseDto, CategoryViewModel>>('CatalogCategory');
    const modelOrchestrator = this.store.getOrchestrator<BaseOrchestrator<BaseDto, ModelViewModel>>('CatalogModel');

    if (options?.includeCategory) {
      const categoryUuids = Array.from(
        new Set(dtos.flatMap(dto => (dto['categoryUuids'] || []) as string[]))
      );

      if (categoryUuids.length > 0) {
        deps.push(categoryOrchestrator.load(categoryUuids));
      }
    }

    if (options?.includeModel) {
      const modelUuids = Array.from(
        new Set(dtos.map(dto => dto['modelUuid'] as string).filter(Boolean))
      );

      if (modelUuids.length > 0) {
        deps.push(modelOrchestrator.load(modelUuids));
      }
    }

    return deps;
  }

  // --- Individual Commands Examples ---

  /**
   * Example Command: Create a product and add it directly to the local cache.
   */
  public createProduct(product: ProductDto): Observable<ProductDto> {
    // In a production app, we would make a POST/PUT command:
    // return this.api.createProduct(product).pipe(tap(newProduct => this.updateCache([newProduct])))
    return of(product).pipe(
      tap(createdProduct => {
        this.updateCache([createdProduct]);
        console.log('[CatalogProductOrchestrator] Product created successfully and added to cache.');
      })
    );
  }

  /**
   * Example Command: Update a product and refresh the cache.
   */
  public updateProduct(product: ProductDto): Observable<ProductDto> {
    return of(product).pipe(
      tap(updatedProduct => {
        this.updateCache([updatedProduct]);
        console.log('[CatalogProductOrchestrator] Product updated successfully.');
      })
    );
  }
}
