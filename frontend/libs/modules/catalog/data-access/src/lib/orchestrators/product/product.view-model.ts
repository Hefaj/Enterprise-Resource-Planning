import { ProductDto } from '../../api-client';
import { CategoryVM } from '../category/category.view-model';
import { ModelVM } from '../model/model.view-model';

export interface ProductVM extends ProductDto {
  /** Resolved category references (from categoryUuids). */
  readonly categories: CategoryVM[];

  /** Resolved model reference (from modelUuid), or null if none. */
  readonly model: ModelVM | null;
}

export interface CatalogProductLoadOptions {
  readonly includeCategories?: boolean;
  readonly includeModel?: boolean;
  [key: string]: boolean | undefined;
}
