import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ErpBreadcrumbBuilder } from './erp-breadcrumb.builder';

export { ErpBreadcrumbBuilder };

export type ErpMenuItem = MenuItem;

export interface ErpBreadcrumb {
  home?: ErpMenuItem;
  items?: ErpMenuItem[];
}

@Component({
  selector: 'erp-breadcrumb',
  imports: [BreadcrumbModule],
  template: `
    @let _config = config();

    <p-breadcrumb
      [home]="_config.home"
      [model]="_config.items"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpBreadcrumbComponent {
  public config = input.required<ErpBreadcrumb>();
}
