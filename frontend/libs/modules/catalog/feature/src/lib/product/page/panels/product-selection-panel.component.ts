import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductListViewStore } from '../product-list-view.store';
import { PRODUCT_KEYS } from '../../translation/keys';

@Component({
  selector: 'erp-product-selection-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="product-selection-panel">
      <h3>Wybrane produkty</h3>
      <p>Liczba zaznaczonych: {{ store.selection()?.selectedItems?.length || 0 }}</p>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      padding: 1rem;
    }
  `]
})
export class ProductSelectionPanelComponent {
  protected readonly store = inject(ProductListViewStore);
  protected readonly PRODUCT_KEYS = PRODUCT_KEYS;
}
