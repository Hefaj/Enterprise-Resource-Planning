import { computed, Injectable } from '@angular/core';
import { MultimediaRow } from './multimedia-row.model';
import { PRODUCT_SCOPE_PREVIEW_LIMIT, ProductScopeTabStore } from '../product-scope-tab.store';

/**
 * Ilu produktów multimedia pokazuje panel, gdy zaznaczenie jest filtrem (`query`).
 * To PRÓBKA — ma pokazać, czego dotyczy operacja, a nie udawać kompletnej listy.
 */
export const MULTIMEDIA_PREVIEW_PRODUCT_LIMIT = PRODUCT_SCOPE_PREVIEW_LIMIT;

@Injectable() // Rejestrowany na poziomie MultimediaTabComponent, aby żył tylko tyle co zakładka
export class MultimediaTabStore extends ProductScopeTabStore<MultimediaRow> {
  /** UUID zaznaczonych plików — payload akcji operujących na wskazanych pozycjach. */
  public readonly selectedMultimedia = computed<Set<string>>(
    () => new Set(this.selectedChildren().map(row => row.uuid)),
  );

  constructor() {
    super(MULTIMEDIA_PREVIEW_PRODUCT_LIMIT);
  }
}
