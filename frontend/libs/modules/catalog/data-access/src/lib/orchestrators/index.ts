// Catalog Orchestrators — public API

export { CatalogProductOrchestrator } from './product/catalog-product.orchestrator';
export { CatalogMultimediaOrchestrator } from './multimedia/catalog-multimedia.orchestrator';
export { CatalogMultimediaContentService } from './multimedia/multimedia-content.service';
export type { MultimediaVariant } from './multimedia/multimedia-content.service';
export { CatalogMultimediaDownloadService } from './multimedia/multimedia-download.service';
export type { MultimediaDownloadResult } from './multimedia/multimedia-download.service';
export type { MultimediaVM } from './multimedia/multimedia.view-model';
export type {
  ProductVM,
  CatalogProductLoadOptions,
  ProductWarrantyVM,
  ProductCodeVM,
  ProductAttributeVM,
} from './product/product.view-model';

export { CatalogModelOrchestrator } from './model/catalog-model.orchestrator';
export type { ModelVM } from './model/model.view-model';

export { CatalogCategoryOrchestrator } from './category/catalog-category.orchestrator';
export type { CategoryVM, CategoryTreeNodeVM } from './category/category.view-model';

export { CatalogWarrantyOrchestrator } from './warranty/catalog-warranty.orchestrator';
export type { WarrantyVM } from './warranty/warranty.view-model';

export { CatalogCodeTypeOrchestrator } from './code-type/catalog-code-type.orchestrator';
export type { CodeTypeVM } from './code-type/code-type.view-model';

export { CatalogAttributeOrchestrator } from './attribute/catalog-attribute.orchestrator';
export type { AttributeVM } from './attribute/attribute.view-model';
export * from './export-run/export-run-result.resolver';
