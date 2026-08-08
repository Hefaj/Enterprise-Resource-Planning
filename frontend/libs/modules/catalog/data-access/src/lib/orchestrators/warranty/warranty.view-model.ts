import { WarrantyDto } from '../../api-client';

export type WarrantyVM = WarrantyDto;

/**
 * Gwarancja rozwiązana w kontekście konkretnego przypisania produkt-gwarancja.
 * `durationMonths` to standardowy okres z katalogu gwarancji, `productDurationMonths`
 * to okres przypisany do tego konkretnego produktu (może się różnić np. w promocji).
 */
export interface ProductWarrantyVM extends WarrantyVM {
  readonly warrantyUuid: string;
  readonly productDurationMonths: number;
}
