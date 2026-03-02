import { ChangeDetectionStrategy, Component, ElementRef, ViewChild } from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { Drawer, DrawerModule } from 'primeng/drawer';
import { RippleModule } from 'primeng/ripple';

@Component({
  selector: 'erp-menu',
  imports: [AvatarModule, ButtonModule, DrawerModule, RippleModule],
  templateUrl: './erp-menu.html',
  styleUrl: './erp-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpMenuComponent {
  public visible = false;

  @ViewChild('drawerRef') private _drawerRef!: Drawer;

  public closeCallback(e: any): void {
    this._drawerRef.close(e);
  }
}
