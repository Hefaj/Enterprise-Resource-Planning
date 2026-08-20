import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { ErpGridLayoutBuilder, ErpGridLayoutComponent, ErpTabsBuilder, ErpTabsComponent } from '@erp/shared/ui';
import { noop } from 'rxjs';

import { UsersStore } from './users.store';
import { UsersFilterComponent } from './filters/users-filter.component';
import { UsersTabComponent } from './content/users-tab.component';
import { UserRolesTabComponent } from './content/side-panel/roles/user-roles-tab.component';
import { UserPermissionsTabComponent } from './content/side-panel/permissions/user-permissions-tab.component';
import { UserEffectivePermissionsTabComponent } from './content/side-panel/effective-permissions/user-effective-permissions-tab.component';
import { provideUsersTranslations } from '../translation';
import { USERS_KEYS } from '../translation';

/**
 * Strona `/identity/users` — dokładnie ten sam szkielet siatki co `ProductComponent`
 * (`frontend/libs/modules/catalog/feature/src/lib/product/page/product.component.ts`).
 *
 * Panel boczny otwiera i zamyka WYŁĄCZNIE wybór zakładki, nigdy zaznaczenie w tabeli
 * (patrz `docs/frontend/pages.md` §3): zakładka `'list'` (bez `component`) to stan
 * "panel schowany", każda kolejna to alternatywny widok otwierany na żądanie —
 * niezależnie od tego, czy i co jest zaznaczone. Za komunikat "nic nie wybrano"
 * odpowiada sama zakładka, nie warunek `collapsed`.
 */
@Component({
  selector: 'erp-identity-users',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErpGridLayoutComponent],
  providers: [UsersStore, provideUsersTranslations()],
  template: `<erp-grid-layout [config]="pageConfig" />`,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        flex: 1;
        height: 100%;
        min-height: 0;
      }
    `,
  ],
})
export class UsersComponent {
  protected readonly activeTabId = signal<string | null>('list');

  protected readonly tabsConfig = ErpTabsBuilder.create((b) =>
    b
      .setLayout('horizontal')
      .withSharedState(this.activeTabId)
      .addTab(USERS_KEYS.detail.tabs.list, 'list', { icon: '@tui.list' })
      .addTab(USERS_KEYS.detail.tabs.roles, 'roles', {
        component: UserRolesTabComponent,
        icon: '@tui.shield',
      })
      .addTab(USERS_KEYS.detail.tabs.permissions, 'permissions', {
        component: UserPermissionsTabComponent,
        icon: '@tui.key',
      })
      .addTab(USERS_KEYS.detail.tabs.effective, 'effective', {
        component: UserEffectivePermissionsTabComponent,
        icon: '@tui.list-checks',
      })
      .setOnTabChange(noop),
  );


  protected readonly pageConfig = ErpGridLayoutBuilder.create((b) =>
    b
      .setLayoutId('identity-users-page')
      .setShowBorders(true)
      .setGrid({
        areas: ['filter tabs    tabs', 'filter content rightPanel'],
        columns: '280px 1fr 420px',
        rows: 'auto 1fr',
        gap: '0',
      })
      .fill('filter', UsersFilterComponent)
      .fill('tabs', ErpTabsComponent, { config: this.tabsConfig, renderMode: 'tabs' })
      .fill('content', UsersTabComponent)
      .fill(
        'rightPanel',
        ErpTabsComponent,
        { config: this.tabsConfig, renderMode: 'content' },
        {
          resizable: 'left',
          minWidth: 340,
          maxWidth: 1600,
          collapsed: computed(() => this.activeTabId() === 'list'),
        },
      ),
  );
}
