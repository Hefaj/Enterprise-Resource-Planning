import { BatchCommandOfProductSetPriceCommand } from '@erp/catalog/data-access';

/**
 * Command for setting the price of multiple products.
 */
export interface SetPriceCommand extends BatchCommandOfProductSetPriceCommand {
  products: { uuid: string; sku: string; price: number }[];
  price: number | null;
}
