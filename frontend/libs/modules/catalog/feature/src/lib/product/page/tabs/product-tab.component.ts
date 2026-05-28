import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogService, DynamicDialogModule } from 'primeng/dynamicdialog';



const STATIC_ATTR_KEYS = ['color', 'weight', 'dimensions', 'material', 'brand', 'warranty'];


const PAGE_SIZE = 50;

/**
 * Smart component zakładki "Produkty".
 * Zarządza stanem: ładowaniem danych, selekcją, dynamicznymi kolumnami i context menu.
 */
@Component({
  selector: 'erp-product-tab',
  standalone: true,
  imports: [CommonModule, DynamicDialogModule],
  providers: [DialogService],
  template: `
    <div class="tab-container">
      
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
    .tab-container {
      padding: 1rem 0;
      height: 100%;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductTabComponent {
  
}
