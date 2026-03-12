import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { CoreBreadcrumbBuilder } from './core-breadcrumb.builder';

export { CoreBreadcrumbBuilder };

export type CoreMenuItem = MenuItem;

export interface CoreBreadcrumb {
  home?: CoreMenuItem;
  items?: CoreMenuItem[];
}

@Component({
  selector: 'core-breadcrumb',
  imports: [BreadcrumbModule],
  templateUrl: './core-breadcrumb.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoreBreadcrumbComponent {
  public config = input.required<CoreBreadcrumb>();
}
