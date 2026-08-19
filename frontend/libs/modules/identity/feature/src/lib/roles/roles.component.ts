import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ErpGridLayoutBuilder, ErpGridLayoutComponent, ErpTabsBuilder, ErpTabsComponent } from '@erp/shared/ui';
import { noop } from 'rxjs';

import { RolesStore } from './roles.store';
import { RolesContentComponent } from './roles-content.component';
import { RolePermissionsTabComponent } from './tabs/role-permissions-tab.component';
import { RoleMembersTabComponent } from './tabs/role-members-tab.component';
import { RoleContainersTabComponent } from './tabs/role-containers-tab.component';
import { RoleHoldersTabComponent } from './tabs/role-holders-tab.component';
import { provideIdentityTranslations } from '../translation';
import { IDENTITY_KEYS } from '../translation';

/**
 * Strona `/identity/roles` — ten sam szkielet siatki co `ProductComponent`: poziomy pasek
 * zakładek nad treścią, stała lista ról w `content`, a zakładki (Uprawnienia/Role
 * składowe/Zawarta w/Kto ma tę rolę) w przeciągalnym, chowanym `rightPanel`. Bez kolumny
 * filtru — ról są dziesiątki, wyszukiwanie w tabeli klienckiej wystarcza.
 */
@Component({
  selector: 'erp-identity-roles',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErpGridLayoutComponent],
  providers: [RolesStore, provideIdentityTranslations()],
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
export class RolesComponent {
  private readonly _store = inject(RolesStore);

  protected readonly tabsConfig = ErpTabsBuilder.create((b) =>
    b
      .setLayout('horizontal')
      .addTab(IDENTITY_KEYS.roles.detail.tabs.permissions, 'permissions', {
        component: RolePermissionsTabComponent,
        icon: '@tui.key',
      })
      .addTab(IDENTITY_KEYS.roles.detail.tabs.members, 'members', {
        component: RoleMembersTabComponent,
        icon: '@tui.git-branch',
      })
      .addTab(IDENTITY_KEYS.roles.detail.tabs.containers, 'containers', {
        component: RoleContainersTabComponent,
        icon: '@tui.arrow-up',
      })
      .addTab(IDENTITY_KEYS.roles.detail.tabs.holders, 'holders', {
        component: RoleHoldersTabComponent,
        icon: '@tui.users',
      })
      .setInitialValue('permissions')
      .setOnTabChange(noop),
  );

  protected readonly pageConfig = ErpGridLayoutBuilder.create((b) =>
    b
      .setLayoutId('identity-roles-page')
      .setShowBorders(true)
      .setGrid({
        areas: ['tabs    tabs', 'content rightPanel'],
        columns: '1fr 420px',
        rows: 'auto 1fr',
        gap: '0',
      })
      .fill('tabs', ErpTabsComponent, { config: this.tabsConfig, renderMode: 'tabs' })
      .fill('content', RolesContentComponent)
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
