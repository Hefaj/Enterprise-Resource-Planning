import { inject, Injectable } from '@angular/core';
import { ErpModalService } from '@erp/shared/ui';
import { SetPriceModalDefinition } from './set-price';

/**
 * Serwis rejestrujący wszystkie modale produktowe w globalnym ErpModalService.
 *
 * Wstrzyknij go w dowolnym komponencie/serwisie produktowym,
 * aby modale były dostępne przez `modalService.open(id, command)`.
 *
 * @example
 * ```ts
 * // W komponencie (rejestracja + użycie):
 * private _productModals = inject(ProductModalRegistration);
 * private _modalService = inject(ErpModalService);
 *
 * // Otwieranie:
 * this._modalService.open('catalog.product.edit-sku', {
 *   productUuids: ['...'],
 *   products: [{ uuid: '...', sku: 'SKU-001' }],
 *   sku: '',
 * });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class ProductModalRegistration {
  constructor() {
    const modalService = inject(ErpModalService);

    modalService.register(
      inject(SetPriceModalDefinition),
    );
  }
}
