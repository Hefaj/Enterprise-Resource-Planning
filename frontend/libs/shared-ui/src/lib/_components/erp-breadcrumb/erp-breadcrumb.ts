import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { MenuItem } from 'primeng/api';

@Component({
  selector: 'erp-breadcrumb',
  templateUrl: `./erp-breadcrumb.html`,
  styleUrls: ['./erp-breadcrumb.scss'],
  standalone: true,
  imports: [BreadcrumbModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpBreadcrumbComponent {
  public readonly $home = input.required<MenuItem>();
  public readonly $items = input.required<MenuItem[] | undefined>();
}
