export type ProductStatus = 'Aktywny' | 'Draft' | 'Wycofany' | 'Archiwum';

/**
 * Command zmiany statusu produktu — identyczny z API command.
 */
export interface EditStatusCommand {
  productUuids: string[];
  products: { uuid: string; sku: string; status?: string }[];
  status: ProductStatus | null;
}
