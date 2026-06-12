import { inject, Injectable } from '@angular/core';
import { ErpModalService } from '@erp/shared/ui';
import { EDIT_SKU_MODAL } from './edit-sku';
import { EDIT_EAN_MODAL } from './edit-ean';
import { EDIT_STATUS_MODAL } from './edit-status';

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
      EDIT_SKU_MODAL,
      EDIT_EAN_MODAL,
      EDIT_STATUS_MODAL,
    );
  }
}
