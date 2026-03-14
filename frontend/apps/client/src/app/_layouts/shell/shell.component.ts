import { Component, computed, inject } from '@angular/core';
import { ErpBreadcrumb, ErpHostLayoutComponent } from '@erp/shared/ui';
import { RouterModule } from '@angular/router';
import { ErpBreadcrumbService, ErpNavigationItem, ErpNavRegistryService } from '@erp/shared/data-access';
import { MenuItem } from 'primeng/api';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-shell',
  imports: [CommonModule, ErpHostLayoutComponent, RouterModule],
  templateUrl: './shell.component.html',
})
export class ShellLayoutComponent {
  private _erpNavRegistryService = inject(ErpNavRegistryService);
  private _erpBreadcrumbService = inject(ErpBreadcrumbService);

  protected $navMenu = computed(() => {
    const navMenu = this._erpNavRegistryService.$navMenu();
    return {
      items: this._mapToPrimeNg(navMenu),
    };
  });

  protected $breadcrumbConfig = computed(() => {
    const { home, items } = this._erpBreadcrumbService.breadcrumb();
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
