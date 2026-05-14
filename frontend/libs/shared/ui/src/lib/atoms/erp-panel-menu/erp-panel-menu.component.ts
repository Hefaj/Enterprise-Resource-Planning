import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { PanelMenu } from 'primeng/panelmenu';
import { ErpPanelMenuConfig } from './erp-panel-menu.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-panel-menu',
  standalone: true,
  imports: [PanelMenu],
  template: `
    @let _items = items();

    <p-panelmenu
      [model]="_items || []"
      class="w-full"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpPanelMenuComponent {
  public config = input.required<ErpPanelMenuConfig>();

  protected items = computed(() => unwrapSignal(this.config().items));
}
