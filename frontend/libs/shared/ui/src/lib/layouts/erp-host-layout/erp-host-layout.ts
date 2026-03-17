import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ErpEmptyCardComponent } from '../../atoms/erp-empty-card/erp-empty-card.component';
import { ErpDrawerComponent } from '../../atoms/erp-drawer/erp-drawer.component';
import { ErpButtonComponent } from '../../atoms/erp-button/erp-button.component';
import { ErpButtonBuilder } from '../../atoms/erp-button/erp-button.builder';
import { ErpPanelMenu, ErpPanelMenuComponent } from '../../atoms/erp-panel-menu/erp-panel-menu.component';
import { ErpBreadcrumb, ErpBreadcrumbComponent } from '../../atoms/erp-breadcrumb/erp-breadcrumb.component';
import { ErpUserMenu, ErpUserMenuComponent } from '../../atoms/erp-user-menu/erp-user-menu.component';

@Component({
  selector: 'erp-host-layout',
  imports: [
    ErpEmptyCardComponent,
    ErpDrawerComponent,
    ErpButtonComponent,
    ErpPanelMenuComponent,
    ErpBreadcrumbComponent,
    ErpUserMenuComponent,
  ],
  templateUrl: './erp-host-layout.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpHostLayoutComponent {
  public userMenuConfig = input.required<ErpUserMenu>();
  public menuConfig = input.required<ErpPanelMenu>();
  public breadcrumbConfig = input.required<ErpBreadcrumb>();
  protected readonly menuBtn = ErpButtonBuilder.create((b) => b.setSeverity('info').setIcon('pi pi-bars'));
}
