import { Component, computed, inject } from '@angular/core';
import { ErpHostLayoutComponent, ErpHostLayoutBuilder, ErpBreadcrumbConfig, ErpUserMenuConfig, ErpPanelMenuComponent, ErpBreadcrumbComponent, ErpUserMenuComponent, ErpModalService } from '@erp/shared/ui';
import { Router, RouterModule } from '@angular/router';
import { ErpBreadcrumbService, ErpNavigationItem, ErpNavRegistryService } from '@erp/shared/data-access';
import { MenuItem } from 'primeng/api';
import { CommonModule } from '@angular/common';
import { noop } from 'rxjs';
import { ErpAuthService } from '@erp/shared/auth';
import { AppSettingsService } from '@erp/client/util';
import { JobPopoverLazyComponent } from './job-popover-lazy.component';

@Component({
  selector: 'erp-shell',
  standalone: true,
  imports: [
    CommonModule,
    ErpHostLayoutComponent,
    RouterModule,
    ErpPanelMenuComponent,
    ErpBreadcrumbComponent,
    ErpUserMenuComponent,
    JobPopoverLazyComponent
  ],
  templateUrl: './shell.component.html',
})
export class ShellLayoutComponent {
  private _navRegistryService = inject(ErpNavRegistryService);
  private _breadcrumbService = inject(ErpBreadcrumbService);
  private _authService = inject(ErpAuthService);
  private _router = inject(Router);
  private _settingsService = inject(AppSettingsService);
  private _modalService = inject(ErpModalService);

  protected $userMenuConfig = computed(() => {
    return {
      items: [
        { label: 'Twój Profil', icon: 'pi pi-user', command: noop },
        {
          label: 'Ustawienia',
          icon: 'pi pi-cog',
          command: (): void => {
            this._router.navigate(['settings']);
          },
        },
        { separator: true },
        {
          label: 'Wyloguj',
          icon: 'pi pi-sign-out',
          command: (): void => this._authService.logout(),
        },
        { separator: true },
      ],
    } as ErpUserMenuConfig;
  });

  protected $navMenu = computed(() => {
    const navMenu = this._navRegistryService.$navMenu();
    return {
      items: this._mapToPrimeNg(navMenu),
    };
  });

  protected $breadcrumbConfig = computed(() => {
    const { home, items } = this._breadcrumbService.breadcrumb();
    return { home, items } as ErpBreadcrumbConfig;
  });

  private _mapToPrimeNg(items: ErpNavigationItem[]): MenuItem[] {
    return items.map((item) => ({
      label: item.label,
      icon: item.iconId ? `pi pi-${item.iconId}` : undefined,
      routerLink: item.disabled ? undefined : item.route,
      disabled: item.disabled,
      items: item.children ? this._mapToPrimeNg(item.children) : undefined,
    }));
  }

  protected onJobSelection = (val: any): void => {
    if (val && val.queueId) {
      let command = {};
      if (val.commandJson) {
        try {
          command = JSON.parse(val.commandJson);
        } catch (e) {
          console.error('Failed to parse commandJson', e);
        }
      }
      this._modalService.open(val.queueId, command);
    }
  };

  protected $hostLayoutConfig = computed(() => {
    return ErpHostLayoutBuilder.create((b) =>
      b.setCloseMenuOnNavigation(true)
    );
  });
}
