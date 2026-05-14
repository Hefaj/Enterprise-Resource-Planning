import { ChangeDetectionStrategy, Component, input, viewChild, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuModule } from 'primeng/menu';
import { ErpMenuConfig } from './erp-menu.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-menu',
  standalone: true,
  imports: [CommonModule, MenuModule],
  template: `
    @let _items = items();
    @let _popup = popup();

    <p-menu
      #menu
      [model]="_items || []"
      [popup]="_popup ?? true"
      [appendTo]="'body'"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpMenuComponent {
  public config = input.required<ErpMenuConfig>();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public menu = viewChild<any>('menu');

  protected items = computed(() => unwrapSignal(this.config().items));
  protected popup = computed(() => unwrapSignal(this.config().popup));

  /**
   * Metoda do otwierania menu (jeśli jest popup)
   */
  public toggle(event: Event): void {
    this.menu()?.toggle(event);
  }
}
