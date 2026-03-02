import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { AccordionModule } from 'primeng/accordion';
import { RippleModule } from 'primeng/ripple';

export interface ErpMenuItem {
  label: string;
  icon?: string;
  badge?: string | number;
  url?: string;
  items?: ErpMenuItem[];
}

@Component({
  selector: 'erp-menu',
  imports: [CommonModule, AvatarModule, ButtonModule, DrawerModule, RippleModule, AccordionModule],
  templateUrl: './erp-menu.html',
  styleUrl: './erp-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpMenuComponent {
  public items = input.required<ErpMenuItem[]>();
  public menuItemClickEvent = output<string>();
  public visible = false;

  public user = {
    name: 'Amy Elsner',
    avatar: 'https://primefaces.org/cdn/primeng/images/demo/avatar/amyelsner.png',
  };

  public closeCallback(_: Event): void {
    this.visible = false;
  }

  public navigate(item: ErpMenuItem): void {
    if (item.url) {
      this.visible = false;
      this.menuItemClickEvent.emit(item.url);
    }
  }
}
