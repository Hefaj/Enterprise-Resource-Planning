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
  template: `
    @let _menuConfig = menuConfig();
    @let _breadcrumbConfig = breadcrumbConfig();
    @let _userMenuConfig = userMenuConfig();

    <erp-drawer #drawer>
      <erp-panel-menu [config]="_menuConfig" />
    </erp-drawer>

    <div class="flex flex-col h-svh w-svw bg-slate-50 dark:bg-slate-900">
      <div class="h-16 flex items-center px-2 bg-white dark:bg-slate-900 shadow-xl">
        <erp-button
          [config]="menuBtn"
          (click)="drawer.show()"
        />
        <erp-breadcrumb
          class="w-full"
          [config]="_breadcrumbConfig"
        />

        <erp-user-menu [config]="_userMenuConfig" />
      </div>
      <main class="flex-1 overflow-auto p-4">
        <ng-content>
          <erp-empty-card />
        </ng-content>
      </main>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpHostLayoutComponent {
  public userMenuConfig = input.required<ErpUserMenu>();
  public menuConfig = input.required<ErpPanelMenu>();
  public breadcrumbConfig = input.required<ErpBreadcrumb>();
  protected readonly menuBtn = ErpButtonBuilder.create((b) => b.setSeverity('info').setIcon('pi pi-bars'));
}
