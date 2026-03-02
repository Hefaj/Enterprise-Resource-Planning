import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { AuthService } from '@erp/auth';
import { ErpBreadcrumbComponent, ErpMenuComponent, ErpMenuItem, ErpNotificationComponent } from '@erp/shared-ui';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { filter, map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, ErpBreadcrumbComponent, ErpMenuComponent, ButtonModule, ErpNotificationComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent {
  private _router = inject(Router);
  private _authService = inject(AuthService);

  public $home = signal<MenuItem>({ label: 'Dashboard', routerLink: '/dashboard' });

  public $items = toSignal(
    this._router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this._buildBreadcrumbs(this._router.routerState.root)),
    ),
  );

  private _buildBreadcrumbs(route: ActivatedRoute, url = '', breadcrumbs: MenuItem[] = []): MenuItem[] | undefined {
    // Pobieramy rzeczywiste segmenty URL (np. 'products', '123' zamiast ':id')
    const path = route.snapshot.url.map((segment: any) => segment.path).join('/');

    const nextUrl = path ? `${url}/${path}` : url;

    const label = route.snapshot.data['breadcrumb'];

    const newBreadcrumbs = [...breadcrumbs];

    if (label) {
      const isDuplicate = newBreadcrumbs.some((b) => b.label === label && b.routerLink === nextUrl);

      if (!isDuplicate) {
        newBreadcrumbs.push({
          label: label,
          routerLink: nextUrl,
        });
      }
    }

    if (route.firstChild) {
      return this._buildBreadcrumbs(route.firstChild, nextUrl, newBreadcrumbs);
    }

    return newBreadcrumbs.length > 0 ? newBreadcrumbs : undefined;
  }

  public logout(): void {
    this._authService.logout();
  }
  public nav(path: string): void {
    this._router.navigate([path]);
  }

  public menuItems: ErpMenuItem[] = [
    {
      label: 'Dashboard',
      icon: 'pi pi-home',
      url: '/dashboard',
    },
    {
      label: 'Moje',
      icon: 'pi pi-th-large',
      items: [
        {
          label: 'Katalog',
          icon: 'pi pi-th-large',
          // url: '/catalog',
          items: [
            {
              label: 'Produkty',
              icon: 'pi pi-box',
              url: '/catalog/product',
            },
          ],
        },
        {
          label: 'Sprzedaż',
          icon: 'pi pi-shopping-cart',
          url: '/sales',
        },
        {
          label: 'Magazyn',
          icon: 'pi pi-warehouse',
          url: '/inventory',
        },
      ],
    },

    {
      label: 'Reports',
      icon: 'pi pi-chart-line',
      items: [
        {
          label: 'Revenue',
          icon: 'pi pi-money-bill',
          items: [
            { label: 'View', icon: 'pi pi-table', url: '/reports/revenue/view' },
            { label: 'Search', icon: 'pi pi-search', url: '/reports/revenue/search' },
          ],
        },
        { label: 'Expenses', icon: 'pi pi-wallet', url: '/reports/expenses' },
      ],
    },
    {
      label: 'Messages',
      icon: 'pi pi-comments',
      badge: 3,
      url: '/messages',
    },
    {
      label: 'Settings',
      icon: 'pi pi-cog',
      items: [
        { label: 'Profile', icon: 'pi pi-user', url: '/settings/profile' },
        { label: 'Security', icon: 'pi pi-shield', url: '/settings/security' },
      ],
    },
  ];
}
