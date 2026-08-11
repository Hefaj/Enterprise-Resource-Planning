import { CategoryDto } from '../../api-client';

export interface CategoryVM extends CategoryDto {
  /** Resolved parent category, or null if root. Max depth guard applied. */
  readonly parent: CategoryVM | null;
}

/**
 * CategoryVM wzbogacony o metadane hierarchii wymagane przez `erp-tree` w trybie server
 * (chevron/stan indeterminate bez pobierania dzieci) — wprost z odpowiedzi backendu
 * (`Catalog.Category.Query.GetCategoryChildren`/`SearchCategoryTree`).
 */
export interface CategoryTreeNodeVM extends CategoryVM {
  readonly hasChildren: boolean;
  readonly childCount: number;
  readonly descendantCount: number;
}
