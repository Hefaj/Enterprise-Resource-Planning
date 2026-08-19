import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ErpGridLayoutBuilder, ErpGridLayoutComponent, ErpTabsBuilder, ErpTabsComponent } from '@erp/shared/ui';
import { noop } from 'rxjs';

import { UsersStore } from './users.store';
import { UsersFilterComponent } from './users-filter.component';
import { UsersContentComponent } from './users-content.component';
import { UserRolesTabComponent } from './tabs/user-roles-tab.component';
import { UserPermissionsTabComponent } from './tabs/user-permissions-tab.component';
import { UserEffectivePermissionsTabComponent } from './tabs/user-effective-permissions-tab.component';
import { provideIdentityTranslations } from '../translation';
import { IDENTITY_KEYS } from '../translation';

/**
 * Strona `/identity/users` — dokładnie ten sam szkielet siatki co `ProductComponent`
 * (`frontend/libs/modules/catalog/feature/src/lib/product/page/product.component.ts`):
 * filtr po lewej, poziomy pasek zakładek nad treścią, stała lista w `content`, a zakładki
 * (Role/Uprawnienia bezpośrednie/Efektywne uprawnienia) renderowane w `rightPanel` —
 * przeciągalnym (`resizable: 'left'`) i chowanym, gdy nic nie jest zaznaczone.
 */
@Component({
  selector: 'erp-identity-users',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErpGridLayoutComponent],
  providers: [UsersStore, provideIdentityTranslations()],
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
  private readonly _store = inject(UsersStore);

  protected readonly tabsConfig = ErpTabsBuilder.create((b) =>
    b
      .setLayout('horizontal')
      .addTab(IDENTITY_KEYS.users.detail.tabs.roles, 'roles', {
        component: UserRolesTabComponent,
        icon: '@tui.shield',
      })
      .addTab(IDENTITY_KEYS.users.detail.tabs.permissions, 'permissions', {
        component: UserPermissionsTabComponent,
        icon: '@tui.key',
      })
      .addTab(IDENTITY_KEYS.users.detail.tabs.effective, 'effective', {
        component: UserEffectivePermissionsTabComponent,
        icon: '@tui.list-checks',
      })
      .setInitialValue('roles')
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
      .fill('content', UsersContentComponent)
      .fill(
        'rightPanel',
        ErpTabsComponent,
        { config: this.tabsConfig, renderMode: 'content' },
        {
          resizable: 'left',
          minWidth: 340,
          maxWidth: 900,
          collapsed: computed(() => !this._store.selectedUuid()),
        },
      ),
  );
}
