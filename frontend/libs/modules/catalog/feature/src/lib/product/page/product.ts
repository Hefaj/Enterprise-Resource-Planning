import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ErpPageLayoutComponent,
  ErpPageLayoutBuilder,
  ErpTabsComponent,
  ErpTabsBuilder
} from '@erp/shared/ui';
import { noop } from 'rxjs';

import { ProductTabComponent } from './tabs/product-tab.component';
import { MultimediaTabComponent } from './tabs/multimedia-tab.component';
import { SalesOfferTabComponent } from './tabs/sales-offer-tab.component';
import { WarrantyTabComponent } from './tabs/warranty-tab.component';
import { ProductFilterComponent } from './filters/product-filter.component';

@Component({
  standalone: true,
  imports: [CommonModule, ErpPageLayoutComponent],
  template: ` <erp-page-layout [config]="pageConfig" /> `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductComponent {
  protected readonly tabsConfig = ErpTabsBuilder.create((b) =>
    b
      .addTab('Produkty', 'products', {
        component: ProductTabComponent,
        icon: 'pi pi-shopping-bag',
      })
      .addTab('Multimedia', 'multimedia', {
        component: MultimediaTabComponent,
        icon: 'pi pi-image',
      })
      .addTab('Oferta sprzedaży', 'sales-offer', {
        component: SalesOfferTabComponent,
        icon: 'pi pi-percentage',
      })
      .addTab('Gwarancje', 'warranties', {
        component: WarrantyTabComponent,
        icon: 'pi pi-verified',
      })
      .setInitialValue('products')
      .setOnTabChange(noop)
  );

  protected readonly pageConfig = ErpPageLayoutBuilder.create((b) =>
    b
      .setLeftSidebar(ProductFilterComponent)
      .setMain(ErpTabsComponent, { config: this.tabsConfig })
  );
}

