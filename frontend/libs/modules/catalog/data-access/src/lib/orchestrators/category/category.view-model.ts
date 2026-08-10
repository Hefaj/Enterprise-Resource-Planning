import { CategoryDto } from '../../api-client';

export interface CategoryVM extends CategoryDto {
  /** Resolved parent category, or null if root. Max depth guard applied. */
  readonly parent: CategoryVM | null;
}

/**
 * CategoryVM wzbogacony o metadane hierarchii wymagane przez `erp-tree` w trybie server
 * (chevron/stan indeterminate bez pobierania dzieci). Dziś liczone z mocka — po podłączeniu
 * realnych endpointów (patrz `category-tree.mock-data.ts`) te pola przyjdą wprost z API.
 */
export interface CategoryTreeNodeVM extends CategoryVM {
  readonly hasChildren: boolean;
  readonly childCount: number;
  readonly descendantCount: number;
}
