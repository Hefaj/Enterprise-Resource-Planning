import { CategoryDto } from '../../api-client';

export interface CategoryVM extends CategoryDto {
  /** Resolved parent category, or null if root. Max depth guard applied. */
  readonly parent: CategoryVM | null;
}
