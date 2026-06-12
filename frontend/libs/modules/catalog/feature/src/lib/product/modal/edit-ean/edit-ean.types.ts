/**
 * Command edycji kodu EAN produktu — identyczny z API command.
 */
export interface EditEanCommand {
  productUuids: string[];
  products: { uuid: string; sku: string; ean?: string }[];
  ean: string;
}
