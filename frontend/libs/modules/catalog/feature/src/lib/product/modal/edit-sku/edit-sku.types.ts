/**
 * Command edycji kodu SKU produktu — identyczny z API command.
 */
export interface EditSkuCommand {
  productUuids: string[];
  products: { uuid: string; sku: string }[];
  sku: string;
}
