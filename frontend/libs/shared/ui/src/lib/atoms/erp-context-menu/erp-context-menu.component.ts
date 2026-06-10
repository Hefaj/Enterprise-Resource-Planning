import { ChangeDetectionStrategy, Component, input, viewChild, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContextMenuModule } from 'primeng/contextmenu';
import { ErpContextMenuConfig } from './erp-context-menu.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-context-menu',
  standalone: true,
  imports: [CommonModule, ContextMenuModule],
  template: `
    @let _items = items();
    @let _global = isGlobal();
    
    <p-contextmenu
      #cm
      [model]="_items || []"
      [global]="_global || false"
      [appendTo]="'body'"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpContextMenuComponent {
  public config = input.required<ErpContextMenuConfig>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public cm = viewChild<any>('cm');

  protected items = computed(() => unwrapSignal(this.config().items));
  protected isGlobal = computed(() => unwrapSignal(this.config().global));

  public show(event: Event): void {
    this.cm()?.show(event);
  }

  public hide(): void {
    this.cm()?.hide();
  }
}
