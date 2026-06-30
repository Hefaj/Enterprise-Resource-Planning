import { ProductDto } from '../../api-client';
import { CategoryVM } from '../category/category.view-model';
import { ModelVM } from '../model/model.view-model';

export interface ProductVM extends ProductDto {
  /** Rozwiązane odniesienia do kategorii (z categoryUuids). */
  readonly categories: CategoryVM[];

  /** Rozwiązane odniesienie do modelu (z modelUuid) lub null. */
  readonly model: ModelVM | null;
}

export interface CatalogProductLoadOptions {
  readonly includeCategories?: boolean;
  readonly includeModel?: boolean;
  [key: string]: boolean | undefined;
}
