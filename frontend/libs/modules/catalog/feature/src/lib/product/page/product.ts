import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpPageLayoutComponent, ErpPageLayoutBuilder } from '@erp/shared/ui';
import { ErpDynamicFilterComponent } from '@erp/shared/ui/erp-dynamic-filter';
import { ErpTabsComponent } from '@erp/shared/ui/erp-tabs';

import { filtersConfig, tabsConfig } from './product.mock';

@Component({
  standalone: true,
  imports: [CommonModule, ErpPageLayoutComponent],
  template: ` <erp-page-layout [config]="pageConfig" /> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductComponent {
  protected readonly pageConfig = ErpPageLayoutBuilder.create((b) => b.setLeftSidebar(ErpDynamicFilterComponent, { config: filtersConfig }).setMain(ErpTabsComponent, { config: tabsConfig }));
}
