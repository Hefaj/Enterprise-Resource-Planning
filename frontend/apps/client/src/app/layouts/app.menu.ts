import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AppMenuitem } from './app.menuitem';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, AppMenuitem, RouterModule],
  template: `<ul class="layout-menu">
    @for (item of model; track item.label) {
      @if (!item.separator) {
        <li
          app-menuitem
          [item]="item"
          [root]="true"
        ></li>
      } @else {
        <li class="menu-separator"></li>
      }
    }
  </ul> `,
})
export class AppMenu {
  public model: MenuItem[] = [];

  public ngOnInit() {
    // this.model = [
    //   {
    //     label: 'Home',
    //     items: [{ label: 'Dashboard', icon: 'pi pi-fw pi-home', routerLink: ['/'] }],
    //   },
    //   {
    //     label: 'Hierarchy',
    //     path: '/hierarchy',
    //     items: [
    //       {
    //         label: 'Submenu 1',
    //         icon: 'pi pi-fw pi-bookmark',
    //         path: '/hierarchy/submenu_1',
    //         items: [
    //           {
    //             label: 'Submenu 1.1',
    //             icon: 'pi pi-fw pi-bookmark',
    //             path: '/hierarchy/submenu_1/submenu_1_1',
    //             items: [
    //               { label: 'Submenu 1.1.1', icon: 'pi pi-fw pi-bookmark' },
    //               { label: 'Submenu 1.1.2', icon: 'pi pi-fw pi-bookmark' },
    //               { label: 'Submenu 1.1.3', icon: 'pi pi-fw pi-bookmark' },
    //             ],
    //           },
    //           {
    //             label: 'Submenu 1.2',
    //             icon: 'pi pi-fw pi-bookmark',
    //             path: '/hierarchy/submenu_1/submenu_1_2',
    //             items: [{ label: 'Submenu 1.2.1', icon: 'pi pi-fw pi-bookmark' }],
    //           },
    //         ],
    //       },
    //       {
    //         label: 'Submenu 2',
    //         icon: 'pi pi-fw pi-bookmark',
    //         path: '/hierarchy/submenu_2',
    //         items: [
    //           {
    //             label: 'Submenu 2.1',
    //             icon: 'pi pi-fw pi-bookmark',
    //             path: '/hierarchy/submenu_2/submenu_2_1',
    //             items: [
    //               { label: 'Submenu 2.1.1', icon: 'pi pi-fw pi-bookmark' },
    //               { label: 'Submenu 2.1.2', icon: 'pi pi-fw pi-bookmark' },
    //             ],
    //           },
    //           {
    //             label: 'Submenu 2.2',
    //             icon: 'pi pi-fw pi-bookmark',
    //             path: '/hierarchy/submenu_2/submenu_2_2',
    //             items: [{ label: 'Submenu 2.2.1', icon: 'pi pi-fw pi-bookmark' }],
    //           },
    //         ],
    //       },
    //     ],
    //   },
    // ];

    this.model = [
      {
        label: 'Dashboard',
        icon: 'pi pi-home',
        path: '/dashboard',
      },
      {
        label: 'Moje',
        icon: 'pi pi-th-large',
        items: [
          {
            label: 'Katalog',
            icon: 'pi pi-th-large',
            path: '/catalog',
            items: [
              {
                label: 'Produkty',
                icon: 'pi pi-box',
                path: '/catalog/product',
              },
            ],
          },
          {
            label: 'Sprzedaż',
            icon: 'pi pi-shopping-cart',
            path: '/sales',
          },
          {
            label: 'Magazyn',
            icon: 'pi pi-warehouse',
            path: '/inventory',
          },
        ],
      },

      {
        label: 'Reports',
        icon: 'pi pi-chart-line',
        path: '/reports',
        items: [
          {
            label: 'Revenue',
            icon: 'pi pi-money-bill',
            path: '/reports/revenue',
            items: [
              { label: 'View', icon: 'pi pi-table', path: '/reports/revenue/view' },
              { label: 'Search', icon: 'pi pi-search', path: '/reports/revenue/search' },
            ],
          },
          { label: 'Expenses', icon: 'pi pi-wallet', path: '/reports/expenses' },
        ],
      },
      {
        label: 'Messages',
        icon: 'pi pi-comments',
        badge: '3',
        path: '/messages',
      },
      {
        label: 'Settings',
        icon: 'pi pi-cog',
        items: [
          { label: 'Profile', icon: 'pi pi-user', path: '/settings/profile' },
          { label: 'Security', icon: 'pi pi-shield', path: '/settings/security' },
        ],
      },
    ];
  }
}
