import { ChangeDetectionStrategy, Component } from '@angular/core';
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
      flex-grow: 1;
      display: block;
      height: 100%;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductComponent {
  protected readonly tabsConfig = ErpTabsBuilder.create((b) =>
    b
      .addTab(PRODUCT_KEYS.base.tabs.products, 'products', {
        component: ProductTabComponent,
        icon: '@tui.shopping-bag',
      })
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
            icon: '@tui.ban',
            children: [
              {
                label: PRODUCT_KEYS.base.tabs.products,
                id: 'products',
                component: ProductTabComponent,
                icon: '@tui.shopping-bag',
              },
              {
                label: PRODUCT_KEYS.base.tabs.multimedia,
                id: 'multimedia',
                component: MultimediaTabComponent,
                icon: '@tui.image',
              },
            ]
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
      .setInitialValue('warranties')
      .setOnTabChange(noop)
  );

  protected readonly pageConfig = ErpPageLayoutBuilder.create((b) =>
    b
      .setLeftSidebar(ProductFilterComponent)
      .setMain(ErpTabsComponent, { config: this.tabsConfig })
  );
}

