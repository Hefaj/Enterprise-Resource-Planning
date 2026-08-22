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
import { provideCategoryTranslations } from '../../category/translation';
import { provideWarrantyTranslations } from '../../warranty/translation';

import { ProductTabComponent } from './content/product-tab.component';
import { MultimediaTabComponent } from './content/side-panel/multimedia/multimedia-tab.component';
import { ExclusionTabComponent } from './content/side-panel/sales-offer/exclusion-tab.component';
import { DeliveryTabComponent } from './content/side-panel/sales-offer/delivery-tab.component';
import { WarrantyTabComponent } from './content/side-panel/warranty/warranty-tab.component';
import { ProductFilterComponent } from './filters/product-filter.component';

@Component({
  standalone: true,
  imports: [ErpGridLayoutComponent],
  providers: [ProductStore, provideProductTranslations(), provideCategoryTranslations(), provideWarrantyTranslations()],
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
  /**
   * Panel boczny otwiera się WYŁĄCZNIE wyborem zakładki — nigdy zaznaczeniem w tabeli
   * (patrz `docs/frontend/pages.md` §3). Zakładka `'list'` (bez `component`) to stan
   * "panel schowany": jej treścią jest sąsiedni obszar `content`.
   */
  protected readonly activeTabId = signal<string | null>('list');

  protected readonly tabsConfig = ErpTabsBuilder.create((b) =>
    b
      .setLayout('horizontal')
      .withSharedState(this.activeTabId)
      .addTab(PRODUCT_KEYS.base.tabs.products, 'list', {
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
        minWidth: 340,
        maxWidth: 1600,
        collapsed: computed(() => this.activeTabId() === 'list'),
      })
  );
}

