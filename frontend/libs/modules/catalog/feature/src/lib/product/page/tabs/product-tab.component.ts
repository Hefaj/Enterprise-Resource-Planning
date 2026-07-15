import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpMenuBarComponent, ErpMenuBarBuilder, ErpModalService } from '@erp/shared/ui';
import { SET_PRICE_MODAL_ID } from '@erp/catalog/util';
import { BatchCommandOfProductSetPriceCommand } from '@erp/catalog/data-access';

@Component({
  selector: 'erp-product-tab',
  standalone: true,
  imports: [CommonModule, ErpMenuBarComponent],
  template: `
      <erp-menu-bar [config]="horizontalMenu" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductTabComponent {
  private readonly modalService = inject(ErpModalService);

  protected readonly horizontalMenu = ErpMenuBarBuilder.create((b) =>
    b
      .addItem((i) =>
        i
          .setLabel('Dodaj produkt')
          .setIconStart('@tui.plus')
      )
      .addItem((i) =>
        i
          .setLabel('Ustaw ceny')
          .setIconStart('@tui.dollar-sign')
          .setFn(() => this.openSetPriceModal())
      )
  );

  private openSetPriceModal(): void {
    this.modalService.open<BatchCommandOfProductSetPriceCommand>(SET_PRICE_MODAL_ID, { products: [] })
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
}

