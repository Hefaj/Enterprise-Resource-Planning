import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';

export type EMenuItem = MenuItem;

export interface EBreadcrumb {
  home?: EMenuItem;
  items?: EMenuItem[];
}

@Component({
  selector: 'e-breadcrumb',
  imports: [BreadcrumbModule],
  templateUrl: './e-breadcrumb.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EBreadcrumbComponent {
  public config = input.required<EBreadcrumb>();
}
