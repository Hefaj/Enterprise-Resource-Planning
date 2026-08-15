export interface CategoryViewModel {
  uuid: string;
  name: string;
  parent?: CategoryViewModel;
}

export interface ModelViewModel {
  uuid: string;
  name: string;
}

export interface ProductViewModel {
  uuid: string;
  name: string;
  categoryUuids: string[];
  modelUuid?: string;
  categories: CategoryViewModel[];
  model?: ModelViewModel;
  /** Kody produktu (SKU, EAN…) — typ wskazany identyfikatorem ze słownika `code_type`. */
  codes: { uuid: string; codeTypeUuid: string; value: string }[];
  price: number;
  availableFrom?: Date;
  status: string;
  available: boolean;
  image?: string | null;
  category: string;
  modelName: string;
  [key: string]: unknown;
}
