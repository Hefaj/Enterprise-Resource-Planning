import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CatalogBffClient, ProductDto, ModelDto, CategoryDto } from '../api-client';
import { CatalogProductOrchestrator } from './catalog-product.orchestrator';
import { CatalogCategoryOrchestrator } from './catalog-category.orchestrator';
import { CatalogModelOrchestrator } from './catalog-model.orchestrator';
import { SignalrSyncService } from '@erp/shared/data-access';

describe('Catalog Orchestrators', () => {
  let productOrchestrator: CatalogProductOrchestrator;
  let categoryOrchestrator: CatalogCategoryOrchestrator;

  const mockCatalogBffClient = {
    getProduct: vi.fn((body) => {
      const mockProducts: ProductDto[] = [
        {
          uuid: 'prod-1',
          name: 'MacBook Pro',
          categoryUuids: ['cat-electronics', 'cat-laptops'],
          modelUuid: 'model-mbp'
        },
        {
          uuid: 'prod-2',
          name: 'iPhone 15',
          categoryUuids: ['cat-electronics', 'cat-smartphones']
        }
      ];
      if (body && body.uuids) {
        return of(mockProducts.filter(p => body.uuids.includes(p.uuid)));
      }
      return of(mockProducts);
    }),
    getModel: vi.fn((body) => {
      const mockModels: ModelDto[] = [
        { uuid: 'model-mbp', name: 'M3 Max 16 inch' }
      ];
      if (body && body.uuids) {
        return of(mockModels.filter(m => body.uuids.includes(m.uuid)));
      }
      return of(mockModels);
    }),
    getCategory: vi.fn((body) => {
      const mockCategories: CategoryDto[] = [
        { uuid: 'cat-electronics', name: 'Electronics', parentUuid: undefined },
        { uuid: 'cat-laptops', name: 'Laptops', parentUuid: 'cat-electronics' },
        { uuid: 'cat-smartphones', name: 'Smartphones', parentUuid: 'cat-electronics' }
      ];
      if (body && body.uuids) {
        return of(mockCategories.filter(c => body.uuids.includes(c.uuid)));
      }
      return of(mockCategories);
    }),
    searchProduct: vi.fn((body) => {
      if (body && body.uuids) {
        return of(body.uuids);
      }
      return of(['prod-1', 'prod-2']);
    }),
    searchCategory: vi.fn((body) => {
      return of(['cat-electronics', 'cat-laptops', 'cat-smartphones']);
    }),
    searchModel: vi.fn((body) => {
      return of(['model-mbp']);
    })
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CatalogProductOrchestrator,
        CatalogCategoryOrchestrator,
        CatalogModelOrchestrator,
        SignalrSyncService,
        { provide: CatalogBffClient, useValue: mockCatalogBffClient }
      ]
    });

    productOrchestrator = TestBed.inject(CatalogProductOrchestrator);
    categoryOrchestrator = TestBed.inject(CatalogCategoryOrchestrator);

    // Reset mock calls
    mockCatalogBffClient.getProduct.mockClear();
    mockCatalogBffClient.getModel.mockClear();
    mockCatalogBffClient.getCategory.mockClear();
    mockCatalogBffClient.searchProduct.mockClear();
    mockCatalogBffClient.searchCategory.mockClear();
    mockCatalogBffClient.searchModel.mockClear();
  });

  it('should resolve and map Product dependencies reactively (Category & Model)', () => {
    return new Promise<void>((resolve, reject) => {
      // 1. Fetch product with includeCategory and includeModel option
      productOrchestrator.load(['prod-1'], { includeCategory: true, includeModel: true }).subscribe({
        next: vms => {
          expect(vms.length).toBe(1);
          const product = vms[0];

          expect(product.uuid).toBe('prod-1');
          expect(product.name).toBe('MacBook Pro');

          // Categories should be resolved and enriched
          expect(product.categories.length).toBe(2);
          expect(product.categories[0].uuid).toBe('cat-electronics');
          expect(product.categories[0].name).toBe('Electronics');
          
          // Hierarchical parent-child mapping check (Category "Laptops" has parent "Electronics")
          expect(product.categories[1].uuid).toBe('cat-laptops');
          expect(product.categories[1].name).toBe('Laptops');
          expect(product.categories[1].parent?.uuid).toBe('cat-electronics');

          // Model should be resolved and enriched
          expect(product.model).toBeDefined();
          expect(product.model?.uuid).toBe('model-mbp');
          expect(product.model?.name).toBe('M3 Max 16 inch');

          resolve();
        },
        error: reject
      });
    });
  });

  it('should react to dependency updates reactively', () => {
    return new Promise<void>((resolve, reject) => {
      // Load product WITHOUT dependencies preloaded first
      productOrchestrator.load(['prod-1']).subscribe({
        next: () => {
          const productSignal = productOrchestrator.getViewModel(['prod-1']);
          
          // Since categories weren't loaded, categories list in VM should be empty
          expect(productSignal().get('prod-1')?.categories.length).toBe(0);

          // Now, load the categories separately in the background
          categoryOrchestrator.load(['cat-electronics', 'cat-laptops']).subscribe({
            next: () => {
              // Because of the Angular Signals graph, the Product VM should AUTOMATICALLY update
              // without needing to reload the product itself!
              const updatedProduct = productSignal().get('prod-1');
              expect(updatedProduct?.categories.length).toBe(2);
              expect(updatedProduct?.categories[0].name).toBe('Electronics');
              resolve();
            },
            error: reject
          });
        },
        error: reject
      });
    });
  });

  it('should support search filters by returning matched aggregate UUIDs', () => {
    return new Promise<void>((resolve, reject) => {
      productOrchestrator.search({ uuids: ['prod-2'] }).subscribe({
        next: uuids => {
          expect(uuids).toEqual(['prod-2']);
          expect(mockCatalogBffClient.searchProduct).toHaveBeenCalledWith({ uuids: ['prod-2'] });
          resolve();
        },
        error: reject
      });
    });
  });
});
