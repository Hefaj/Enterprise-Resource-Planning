import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  ErpGridLayoutBuilder,
  ErpGridLayoutComponent,
  ErpTabsBuilder,
  ErpTabsComponent,
} from '@erp/shared/ui';
import { noop } from 'rxjs';
import { ProductStore } from './product.store';
import { provideProductTranslations, PRODUCT_KEYS } from '../translation';

import { ProductTabComponent } from './tabs/product-tab.component';
import { MultimediaTabComponent } from './tabs/multimedia/multimedia-tab.component';
import { ExclusionTabComponent } from './tabs/sales-offer-tabs/exclusion-tab.component';
import { DeliveryTabComponent } from './tabs/sales-offer-tabs/delivery-tab.component';
import { WarrantyTabComponent } from './tabs/warranty/warranty-tab.component';
import { ProductFilterComponent } from './filters/product-filter.component';

@Component({
  standalone: true,
  imports: [ErpGridLayoutComponent],
  providers: [ProductStore, provideProductTranslations()],
  template: `<erp-grid-layout [config]="pageConfig" />`,
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
  protected readonly activeTabId = signal<string | null>('products');

  protected readonly tabsConfig = ErpTabsBuilder.create((b) =>
    b
      .setLayout('horizontal')
      .withSharedState(this.activeTabId)
      .addTab('Lista produktów', 'products', {
        icon: '@tui.list',
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

  private readonly store = inject(ProductStore);

  protected readonly pageConfig = ErpGridLayoutBuilder.create((b) =>
    b
      .setLayoutId('catalog-products-page')
      .setShowBorders(true)
      .setGrid({
        areas: [
          'filter tabs    tabs',
          'filter content rightPanel',
        ],
        columns: '280px 1fr 280px',
        rows: 'auto 1fr',
        gap: '0',
      })
      .fill('filter', ProductFilterComponent)
      .fill('tabs', ErpTabsComponent, { config: this.tabsConfig, renderMode: 'tabs' })
      .fill('content', ProductTabComponent)
      .fill('rightPanel', ErpTabsComponent, { config: this.tabsConfig, renderMode: 'content' }, {
        resizable: 'left',
        minWidth: 600,
        maxWidth: 1600,
        collapsed: computed(() => this.activeTabId() === 'products'),
      })
  );
}

