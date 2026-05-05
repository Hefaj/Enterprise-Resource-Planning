import { ChangeDetectionStrategy, Component, input, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { ErpMenuBuilder } from './erp-menu.builder';

export { ErpMenuBuilder };

export interface ErpMenuConfig {
  items: MenuItem[];
  popup?: boolean;
}

@Component({
  selector: 'erp-menu',
  standalone: true,
  imports: [CommonModule, MenuModule],
  template: `
    <p-menu
      #menu
      [model]="config().items"
      [popup]="config().popup ?? true"
      [appendTo]="'body'"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpMenuComponent {
  public config = input.required<ErpMenuConfig>();
  public menu = viewChild<any>('menu');

  /**
   * Metoda do otwierania menu (jeśli jest popup)
   */
  public toggle(event: Event): void {
    this.menu()?.toggle(event);
  }
}
