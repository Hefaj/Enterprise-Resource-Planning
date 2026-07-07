import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { noop } from 'rxjs';

// import { ProductTabComponent } from './tabs/product-tab.component';
// import { MultimediaTabComponent } from './tabs/multimedia-tab.component';
// import { SalesOfferTabComponent } from './tabs/sales-offer-tab.component';
// import { WarrantyTabComponent } from './tabs/warranty-tab.component';
// import { ProductFilterComponent } from './filters/product-filter.component';
import { ProductListViewStore } from './product-list-view.store';
import { provideProductTranslations, PRODUCT_KEYS } from '../translation';

@Component({
  standalone: true,
  imports: [CommonModule],
  providers: [ProductListViewStore, provideProductTranslations()],
  template: ``,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductComponent {
  // protected readonly tabsConfig = ErpTabsBuilder.create((b) =>
  //   b
  //     .addTab(PRODUCT_KEYS.base.tabs.products, 'products', {
  //       component: ProductTabComponent,
  //       icon: 'pi pi-shopping-bag',
  //     })
  //     .addTab(PRODUCT_KEYS.base.tabs.multimedia, 'multimedia', {
  //       component: MultimediaTabComponent,
  //       icon: 'pi pi-image',
  //     })
  //     .addTab(PRODUCT_KEYS.base.tabs.salesOffer, 'sales-offer', {
  //       component: SalesOfferTabComponent,
  //       icon: 'pi pi-percentage',
  //     })
  //     .addTab(PRODUCT_KEYS.base.tabs.warranties, 'warranties', {
  //       component: WarrantyTabComponent,
  //       icon: 'pi pi-verified',
  //     })
  //     .setInitialValue('products')
  //     .setOnTabChange(noop)
  // );

  // protected readonly pageConfig = ErpPageLayoutBuilder.create((b) =>
  //   b
  //     .setLeftSidebar(ProductFilterComponent)
  //     .setMain(ErpTabsComponent, { config: this.tabsConfig })
  // );
}

