import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductTableComponent } from '@erp/catalog/ui';
import { products } from '../product.mock';

@Component({
  selector: 'erp-product-tab',
  standalone: true,
  imports: [CommonModule, ProductTableComponent],
  template: `
    <div class="tab-container">
      <catalog-product-table [data]="products()" />
    </div>
  `,
  styles: [
    `
      .tab-container {
        padding: 1rem 0;
        height: 100%;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductTabComponent {
  protected readonly products = products;
}

