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
  sku: string;
  price: number;
  availableFrom?: Date;
  status: string;
  available: boolean;
  ean: string;
  image?: string | null;
  category: string;
  modelName: string;
  [key: string]: unknown;
}
