import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { RippleModule } from 'primeng/ripple';

export interface ErpUserMenuItem {
  label: string;
  icon?: string;
  command?: () => void;
}
export interface ErpUserMenu {
  items: ErpUserMenuItem[];
}

@Component({
  selector: 'erp-user-menu',
  imports: [ButtonModule, AvatarModule, MenuModule, RippleModule],
  templateUrl: './erp-user-menu.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpUserMenuComponent {
  public config = input.required<ErpUserMenu>();
}
