import { ProductDto } from '../../api-client';
import { CategoryVM } from '../category/category.view-model';
import { ModelVM } from '../model/model.view-model';
import { MultimediaVM } from '../multimedia/multimedia.view-model';
import { ProductWarrantyVM } from '../warranty/warranty.view-model';

export interface ProductVM extends ProductDto {
  /** Rozwiązane odniesienia do kategorii (z categoryUuids). */
  readonly categories: CategoryVM[];

  /** Rozwiązane odniesienie do modelu (z modelUuid) lub null. */
  readonly model: ModelVM | null;

  /** Rozwiązane multimedia powiązane z produktem. */
  readonly multimedia: MultimediaVM[];

  /** Rozwiązane gwarancje powiązane z produktem, wraz z okresem trwania przypisanym do produktu. */
  readonly warranties: ProductWarrantyVM[];
}

export interface CatalogProductLoadOptions {
  readonly includeCategories?: boolean;
  readonly includeModel?: boolean;
  readonly includeMultimedia?: boolean;
  readonly includeWarranties?: boolean;
  [key: string]: boolean | undefined;
}
