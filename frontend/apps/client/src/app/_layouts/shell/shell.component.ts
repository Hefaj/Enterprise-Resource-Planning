import { Component, computed, inject } from '@angular/core';
import { ErpBreadcrumb, ErpHostLayoutComponent, ErpUserMenu } from '@erp/shared/ui';
import { Router, RouterModule } from '@angular/router';
import { ErpBreadcrumbService, ErpNavigationItem, ErpNavRegistryService } from '@erp/shared/data-access';
import { MenuItem } from 'primeng/api';
import { CommonModule } from '@angular/common';
import { noop } from 'rxjs';
import { ErpAuthService } from '@erp/shared/auth';

@Component({
  selector: 'app-shell',
  imports: [CommonModule, ErpHostLayoutComponent, RouterModule],
  templateUrl: './shell.component.html',
})
export class ShellLayoutComponent {
  private _navRegistryService = inject(ErpNavRegistryService);
  private _breadcrumbService = inject(ErpBreadcrumbService);
  private _authService = inject(ErpAuthService);
  private _router = inject(Router);

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
          linkClass: '!text-red-500 dark:!text-red-400',
        },
        { separator: true },
      ],
    } as ErpUserMenu;
  });

  protected $navMenu = computed(() => {
    const navMenu = this._navRegistryService.$navMenu();
    return {
      items: this._mapToPrimeNg(navMenu),
    };
  });

  protected $breadcrumbConfig = computed(() => {
    const { home, items } = this._breadcrumbService.breadcrumb();
    return { home, items } as ErpBreadcrumb;
  });

  private _mapToPrimeNg(items: ErpNavigationItem[]): MenuItem[] {
    return items.map((item) => ({
      label: item.label,
      icon: item.iconId ? `pi pi-${item.iconId}` : undefined,
      routerLink: item.route,
      items: item.children ? this._mapToPrimeNg(item.children) : undefined,
    }));
  }
}
