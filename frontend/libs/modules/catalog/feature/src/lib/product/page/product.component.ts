import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  ErpPageLayoutBuilder,
  ErpPageLayoutComponent,
  ErpTabsBuilder,
  ErpTabsComponent,
} from '@erp/shared/ui';
import { noop } from 'rxjs';
import { ProductListViewStore } from './product-list-view.store';
import { provideProductTranslations, PRODUCT_KEYS } from '../translation';

import { ProductTabComponent } from './tabs/product-tab.component';
import { MultimediaTabComponent } from './tabs/multimedia-tab.component';
import { ExclusionTabComponent } from './tabs/sales-offer-tabs/exclusion-tab.component';
import { DeliveryTabComponent } from './tabs/sales-offer-tabs/delivery-tab.component';
import { WarrantyTabComponent } from './tabs/warranty-tab.component';
import { ProductFilterComponent } from './filters/product-filter.component';

@Component({
  standalone: true,
  imports: [ErpPageLayoutComponent],
  providers: [ProductListViewStore, provideProductTranslations()],
  template: `<erp-page-layout [config]="pageConfig" />`,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      height: 100%;
      min-height: 0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductComponent {
  protected readonly tabsConfig = ErpTabsBuilder.create((b) =>
    b
      .addTab(PRODUCT_KEYS.base.tabs.multimedia, 'multimedia', {
        component: MultimediaTabComponent,
        icon: '@tui.image',
      })
      .addTab(PRODUCT_KEYS.base.tabs.salesOffer, 'sales-offer', {
        icon: '@tui.percent',
        children: [
          {
            label: PRODUCT_KEYS.base.salesOffer.tabs.exclusion,
            id: 'exclusion',
            component: ExclusionTabComponent,
            icon: '@tui.ban',
          },
          {
            label: PRODUCT_KEYS.base.salesOffer.tabs.delivery,
            id: 'delivery',
            component: DeliveryTabComponent,
            icon: '@tui.truck',
          },
        ],
      })
      .addTab(PRODUCT_KEYS.base.tabs.warranties, 'warranties', {
        component: WarrantyTabComponent,
        icon: '@tui.shield-check',
      })
      .setInitialValue('multimedia')
      .setOnTabChange(noop)
  );

  private readonly store = inject(ProductListViewStore);

  protected readonly pageConfig = ErpPageLayoutBuilder.create((b) =>
    b
      .setLayoutId('catalog-products-page')
      .setLeftSidebar(ProductFilterComponent)
      .setSidebarCollapsed(false)
      .setMain(ProductTabComponent)
      .setRightSidebar(ErpTabsComponent, { config: this.tabsConfig })
      .setLeftSidebarResizable(false)
      .setRightSidebarMinWidth(600)
      .setRightSidebarMaxWidth(1600)
      .setRightSidebarCollapsed(computed(() => {
        const selection = this.store.selection();
        return !(selection && selection.selectedItems && selection.selectedItems.length > 0);
      }))
  );
}

