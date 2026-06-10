import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ErpBreadcrumbConfig } from './erp-breadcrumb.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-breadcrumb',
  standalone: true,
  imports: [BreadcrumbModule],
  template: `
    @let _home = home();
    @let _items = items();

    <p-breadcrumb
      [home]="_home"
      [model]="_items"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpBreadcrumbComponent {
  public config = input.required<ErpBreadcrumbConfig>();

  protected home = computed(() => unwrapSignal(this.config().home));
  protected items = computed(() => unwrapSignal(this.config().items));
}
