import { Component, OnInit } from '@angular/core';
import {
  CoreBreadcrumb,
  CoreBreadcrumbComponent,
  CoreButtonComponent,
  CoreEmptyCardComponent,
  EButtonBuilder,
} from '@erp/shared/ui';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DrawerModule } from 'primeng/drawer';
import { ToolbarModule } from 'primeng/toolbar';
import { AvatarModule } from 'primeng/avatar';
import { PopoverModule } from 'primeng/popover';
import { MenuModule } from 'primeng/menu';
import { BadgeModule } from 'primeng/badge';
import { MenuItem } from 'primeng/api';

@Component({
  selector: 'app-tilewind',
  imports: [
    ButtonModule,
    CardModule,
    CoreBreadcrumbComponent,
    CoreButtonComponent,
    DrawerModule,
    ToolbarModule,
    AvatarModule,
    PopoverModule,
    MenuModule,
    BadgeModule,
    CoreEmptyCardComponent,
  ],
  templateUrl: './tilewind.html',
})
export class TilewindLayout implements OnInit {
  public breadcrums = {
    home: { label: 'Home' },
    items: [
      {
        label: 'A',
      },
      {
        label: 'B',
      },
    ],
  } as CoreBreadcrumb;

  public filterBtn = EButtonBuilder.create((b) => b.setIcon('pi pi-bars'));

  public filter = false;

  public items: MenuItem[] | undefined;

  public ngOnInit(): void {
    this.items = [
      {
        separator: true,
      },
      {
        label: 'Documents',
        items: [
          {
            label: 'New',
            icon: 'pi pi-plus',
            shortcut: '⌘+N',
          },
          {
            label: 'Search',
            icon: 'pi pi-search',
            shortcut: '⌘+S',
          },
        ],
      },
      {
        label: 'Profile',
        items: [
          {
            label: 'Settings',
            icon: 'pi pi-cog',
            shortcut: '⌘+O',
          },
          {
            label: 'Messages',
            icon: 'pi pi-inbox',
            badge: '2',
          },
          {
            label: 'Logout',
            icon: 'pi pi-sign-out',
            shortcut: '⌘+Q',
            linkClass: '!text-red-500 dark:!text-red-400',
          },
        ],
      },
      {
        separator: true,
      },
    ];
  }
}
