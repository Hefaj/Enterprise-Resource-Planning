import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpTabsComponent, ErpTabsBuilder } from '@erp/shared/ui';
import { noop } from 'rxjs';
import { ManualExclusionTabComponent } from './manual-exclusion-tab.component';
import { DeliveryOptionsTabComponent } from './delivery-options-tab.component';
import { PRODUCT_KEYS } from '../../translation';

@Component({
  selector: 'erp-sales-offer-tab',
  standalone: true,
  imports: [CommonModule, ErpTabsComponent],
  template: `
    <div class="nested-tabs-container">
      <erp-tabs [config]="subTabsConfig" />
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }
      .nested-tabs-container {
        height: 100%;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesOfferTabComponent {
  protected readonly subTabsConfig = ErpTabsBuilder.create((b) =>
    b
      .addTab(PRODUCT_KEYS.base.salesOffer.tabs.exclusion, 'exclusion', {
        component: ManualExclusionTabComponent,
        icon: 'pi pi-eye-slash'
      })
      .addTab(PRODUCT_KEYS.base.salesOffer.tabs.delivery, 'delivery', {
        component: DeliveryOptionsTabComponent,
        icon: 'pi pi-truck'
      })
      .setInitialValue('exclusion')
      .setOnTabChange(noop)
  );
}
