import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpMenuBarComponent, ErpMenuBarBuilder, ErpModalService, ErpSelectionState } from '@erp/shared/ui';
import { SET_NAME_MODAL_ID, SET_PRICE_MODAL_ID } from '@erp/catalog/util';
import { BatchCommandOfProductSetNameCommandAndSearchProductRequest, BatchCommandOfProductSetPriceCommandAndSearchProductRequest, SearchProductRequest, ProductVM } from '@erp/catalog/data-access';
import { CategoryProductTableComponent } from '../../components/category-product-table/category-product-table.component';
import { ProductListViewStore } from '../product-list-view.store';

@Component({
  selector: 'erp-product-tab',
  standalone: true,
  imports: [CommonModule, ErpMenuBarComponent, CategoryProductTableComponent],
  template: `
    <div class="flex flex-col h-full w-full">
      <erp-menu-bar [config]="horizontalMenu" />
      <div class="flex-1 py-4 overflow-hidden">
        <erp-category-product-table 
          stateKey="product-tab-main"
          [filters]="currentFilters()"
          (selectionChange)="onSelectionChange($event)"
          class="block h-full"
        />
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductTabComponent {
  private readonly modalService = inject(ErpModalService);
  private readonly store = inject(ProductListViewStore);

  protected readonly horizontalMenu = ErpMenuBarBuilder.create((b) =>
    b
      .addItem((i) =>
        i
          .setLabel('Produkt aktywny')
          .setFn(() => {
            console.log('Kliknieto');
          })
       )
      .addSeparator()
      .addItem((i) =>
        i
          .setLabel('Ustaw nazwe')
          .setIconStart('@tui.bookmark')
          .setFn(() => this.openSetNameModal())
      )
      .addItem((i) =>
        i
          .setLabel('Ustaw ceny')
          .setIconStart('@tui.dollar-sign')
          .setFn(() => this.openSetPriceModal())
      )
  );

  currentFilters = this.store.filters;

  onSelectionChange(state: ErpSelectionState<ProductVM>): void {
    this.store.setSelection(state);
  }

  private openSetPriceModal(): void {
    this.modalService.open<BatchCommandOfProductSetPriceCommandAndSearchProductRequest>(SET_PRICE_MODAL_ID, { products: [] })
      .then(ref => {
        console.log('[ProductTabComponent] Modal opened successfully!', ref);

        ref.closed.then(result => {
          console.log('[ProductTabComponent] Modal closed with result:', result);
        });
      })
      .catch(err => {
        console.error('[ProductTabComponent] Error opening modal:', err);
      });
  }

  private openSetNameModal(): void {
    this.modalService.open<BatchCommandOfProductSetNameCommandAndSearchProductRequest>(SET_NAME_MODAL_ID, { products: [] })
      .then(ref => {
        console.log('[ProductTabComponent] Modal opened successfully!', ref);

        ref.closed.then(result => {
          console.log('[ProductTabComponent] Modal closed with result:', result);
        });
      })
      .catch(err => {
        console.error('[ProductTabComponent] Failed to open modal:', err);
      });
  }
}

