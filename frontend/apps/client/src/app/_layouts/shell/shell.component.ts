import { Component, inject, OnInit } from '@angular/core';
import { CoreHostLayoutComponent, CorePanelMenu } from '@erp/shared/ui';
import { RouterModule } from '@angular/router';
import { ErpNavigationItem, NavRegistryService } from '@erp/shared/data-access-navigation';
import { MenuItem } from 'primeng/api';
import { CoreButtonComponent } from '@erp/shared/ui';

@Component({
  selector: 'app-shell',
  imports: [CoreHostLayoutComponent, RouterModule],
  templateUrl: './shell.component.html',
})
export class ShellLayoutComponent implements OnInit {
  protected menuConfig!: CorePanelMenu;

  private _navRegistryService = inject(NavRegistryService);

  public ngOnInit(): void {
    const navMenu = this._navRegistryService.$navMenu();
    this.menuConfig = {
      items: this._mapToPrimeNg(navMenu),
    };
  }

  private _mapToPrimeNg(items: ErpNavigationItem[]): MenuItem[] {
    return items.map((item) => ({
      label: item.label,
      icon: item.iconId ? `pi pi-${item.iconId}` : undefined,
      routerLink: item.route,
      items: item.children ? this._mapToPrimeNg(item.children) : undefined,
    }));
  }
}
