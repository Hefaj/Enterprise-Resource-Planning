import { ChangeDetectionStrategy, Component, input, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContextMenuModule } from 'primeng/contextmenu';
import { MenuItem } from 'primeng/api';
import { ErpContextMenuBuilder } from './erp-context-menu.builder';

export { ErpContextMenuBuilder };

export interface ErpContextMenuConfig {
  items: MenuItem[];
  global?: boolean;
}

@Component({
  selector: 'erp-context-menu',
  standalone: true,
  imports: [CommonModule, ContextMenuModule],
  template: `
    <p-contextmenu
      #cm
      [model]="config().items"
      [global]="config().global"
      [appendTo]="'body'"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpContextMenuComponent {
  public config = input.required<ErpContextMenuConfig>();
  public cm = viewChild<any>('cm');

  public show(event: Event): void {
    this.cm()?.show(event);
  }

  public hide(): void {
    this.cm()?.hide();
  }
}
