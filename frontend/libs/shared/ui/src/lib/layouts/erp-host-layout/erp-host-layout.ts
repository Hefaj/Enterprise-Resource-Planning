import { ChangeDetectionStrategy, Component, input, viewChild, computed } from '@angular/core';
import { ErpEmptyCardComponent } from '@erp/shared/ui/erp-empty-card';
import { ErpDrawerComponent } from '@erp/shared/ui/erp-drawer';
import { ErpButtonComponent, ErpButtonBuilder } from '@erp/shared/ui/erp-button';
import { ErpPanelMenuConfig, ErpPanelMenuComponent } from '@erp/shared/ui/erp-panel-menu';
import { ErpBreadcrumbConfig, ErpBreadcrumbComponent } from '@erp/shared/ui/erp-breadcrumb';
import { ErpUserMenuConfig, ErpUserMenuComponent } from '@erp/shared/ui/erp-user-menu';

@Component({
  selector: 'erp-host-layout',
  standalone: true,
  imports: [ErpEmptyCardComponent, ErpDrawerComponent, ErpButtonComponent, ErpPanelMenuComponent, ErpBreadcrumbComponent, ErpUserMenuComponent],
  template: `
    @let _menuConfig = menuConfig();
    @let _breadcrumbConfig = breadcrumbConfig();
    @let _userMenuConfig = userMenuConfig();
    @let _menuBtnConfig = menuBtnConfig();

    <erp-drawer #drawer>
      <erp-panel-menu [config]="_menuConfig" />
    </erp-drawer>

    <div class="flex flex-col h-svh w-svw bg-slate-50 dark:bg-slate-900">
      <div class="h-16 flex items-center px-2 bg-white dark:bg-slate-900 shadow-xl">
        <erp-button
          [config]="_menuBtnConfig"
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
  public userMenuConfig = input.required<ErpUserMenuConfig>();
  public menuConfig = input.required<ErpPanelMenuConfig>();
  public breadcrumbConfig = input.required<ErpBreadcrumbConfig>();

  protected drawer = viewChild.required<ErpDrawerComponent>('drawer');

  protected menuBtnConfig = computed(() =>
    ErpButtonBuilder.create((b) =>
      b.setSeverity('info')
       .setIcon('pi pi-bars')
       .setOnClick(() => this.drawer().show())
    )
  );
}
