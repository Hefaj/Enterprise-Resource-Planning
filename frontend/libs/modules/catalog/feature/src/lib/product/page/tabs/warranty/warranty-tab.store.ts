import { computed, Injectable } from '@angular/core';
import { ProductWarrantyVM } from '@erp/catalog/data-access';
import { PRODUCT_SCOPE_PREVIEW_LIMIT, ProductScopeTabStore } from '../product-scope-tab.store';

/**
 * Ilu produktów gwarancje pokazuje panel, gdy zaznaczenie jest filtrem (`query`).
 * To PRÓBKA — ma pokazać, czego dotyczy operacja, a nie udawać kompletnej listy.
 */
export const WARRANTY_PREVIEW_PRODUCT_LIMIT = PRODUCT_SCOPE_PREVIEW_LIMIT;

@Injectable() // Rejestrowany na poziomie WarrantyTabComponent, aby żył tylko tyle co zakładka
export class WarrantyTabStore extends ProductScopeTabStore<ProductWarrantyVM> {
  /**
   * Zaznaczone gwarancje pogrupowane po produkcie — payload akcji operujących na WSKAZANYCH
   * przypisaniach (ta sama gwarancja katalogowa bywa przypięta do wielu produktów, więc sam
   * `warrantyUuid` nie identyfikuje wiersza).
   */
  public readonly selectedWarrantiesByProduct = computed<Record<string, string[]>>(() => {
    const dict: Record<string, string[]> = {};
    for (const item of this.selectedChildren()) {
      (dict[item.productUuid] ??= []).push(item.warrantyUuid);
    }
    return dict;
  });

  constructor() {
    super(WARRANTY_PREVIEW_PRODUCT_LIMIT);
  }
}
