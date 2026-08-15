import { Injectable, inject, signal } from '@angular/core';
import { Router, NavigationEnd, ActivatedRouteSnapshot } from '@angular/router';
import { filter } from 'rxjs';

export interface ErpBreadcrumbData {
  home: ErpBreadcrumbItem;
  items: ErpBreadcrumbItem[];
}

export interface ErpBreadcrumbItem {
  id?: string;
  label?: string;
  routerLink?: string | string[];
  iconId?: string; 
}

@Injectable({ providedIn: 'root' })
export class ErpBreadcrumbService {
  private readonly _router = inject(Router);

  // Reaktywny stan dla Twojego komponentu
  private readonly _breadcrumb = signal<ErpBreadcrumbData>({
    home: { iconId: 'home', routerLink: '/' },
    items: [],
  });

  public readonly breadcrumb = this._breadcrumb.asReadonly();

  public constructor() {
    this._router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      const root = this._router.routerState.snapshot.root;
      const items = this._buildBreadcrumb(root);

      this._breadcrumb.update((state) => ({ ...state, items }));
    });
  }

  /**
   * Pozwala komponentowi nadpisać ostatni element (lub dodać nowe)
   * Używane np. do dynamicznych nazw produktów.
   */
  public setDynamicOverride(dynamicItems: ErpBreadcrumbItem[]): void {
    this._breadcrumb.update((state) => {
      // W prostej wersji po prostu podmieniamy/dodajemy elementy do obecnego stanu
      // W wersji zaawansowanej Twój ErpBreadcrumbBuilder mógłby to elegancko łączyć
      const baseItems = state.items?.filter((i) => !i.id?.startsWith('dynamic-')) || [];
      return { ...state, items: [...baseItems, ...dynamicItems] };
    });
  }

  private _buildBreadcrumb(
    route: ActivatedRouteSnapshot,
    url = '',
    breadcrumbs: ErpBreadcrumbItem[] = [],
  ): ErpBreadcrumbItem[] {
    const children = route.children;
    if (children.length === 0) return breadcrumbs;

    for (const child of children) {
      const routeURL = child.url.map((segment) => segment.path).join('/');
      if (routeURL !== '') {
        url += `/${routeURL}`;
      }

      // `routeConfig.data`, a NIE `child.data`: to drugie jest już scalone z danymi przodków
      // (Angular dziedziczy `data` w dół, dopóki po drodze nie trafi na trasę z komponentem
      // i niepustą ścieżką). Trasa pośrednia bez własnego `breadcrumb` — np. `notification/jobs`,
      // która tylko doładowuje dzieci — powtarzałaby wtedy etykietę rodzica
      // („Notyfikacje > Notyfikacje > Historia zadań”). Do chlebków liczy się wyłącznie to,
      // co dana trasa zadeklarowała sama.
      const label = child.routeConfig?.data?.['breadcrumb'];
      if (label) {
        breadcrumbs.push({ label, routerLink: url });
      }

      return this._buildBreadcrumb(child, url, breadcrumbs);
    }
    return breadcrumbs;
  }
}
