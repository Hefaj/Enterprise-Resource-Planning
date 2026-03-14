import { Injectable, signal } from '@angular/core';

export interface NavigationItem {
  id?: string;
  label: string;
  route?: string | string[]; // Twoja domena nazywa to "route", a nie "routerLink"
  iconId?: string; // Zamiast "pi pi-box", np. po prostu "box"
  children?: NavigationItem[];
}

@Injectable({
  providedIn: 'root',
})
export class NavRegistryService {
  private readonly _$menuItems = signal<NavigationItem[]>([]);
  public $navMenu = this._$menuItems.asReadonly();

  public register(nav: NavigationItem): void {
    this._$menuItems.update((items) => {
      const filtered = items.filter((item) => item.id != nav.id);
      return [...filtered, nav];
    });
  }
}
