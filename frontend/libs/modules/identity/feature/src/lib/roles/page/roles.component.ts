import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ErpGridLayoutBuilder, ErpGridLayoutComponent, ErpTabsBuilder, ErpTabsComponent } from '@erp/shared/ui';
import { noop } from 'rxjs';

import { RolesStore } from './roles.store';
import { RolesTabComponent } from './content/roles-tab.component';
import { RolePermissionsTabComponent } from './content/side-panel/permissions/role-permissions-tab.component';
import { RoleMembersTabComponent } from './content/side-panel/members/role-members-tab.component';
import { RoleContainersTabComponent } from './content/side-panel/containers/role-containers-tab.component';
import { RoleHoldersTabComponent } from './content/side-panel/holders/role-holders-tab.component';
import { provideRolesTranslations } from '../translation';
import { ROLES_KEYS } from '../translation';

/**
 * Strona `/identity/roles` — ten sam szkielet siatki co `ProductComponent`: poziomy pasek
 * zakładek nad treścią, stała lista ról w `content`, a zakładki (Lista/Uprawnienia/Role
 * składowe/Zawarta w/Kto ma tę rolę) w przeciągalnym, chowanym `rightPanel`. Pierwsza zakładka
 * (`'list'`) to — tak jak `'products'` w `ProductComponent` — zakładka bez `component` (patrz
 * `docs/frontend/pages.md` §3 pkt 1): jej „treścią" jest sąsiedni obszar `content`, a jej jedyna
 * rola to ręczne schowanie panelu bocznego bez utraty zaznaczenia. Bez kolumny filtru — ról są
 * dziesiątki, wyszukiwanie w tabeli klienckiej wystarcza.
 */
@Component({
  selector: 'erp-identity-roles',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErpGridLayoutComponent],
  providers: [RolesStore, provideRolesTranslations()],
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

  protected readonly activeTabId = signal<string | null>(null);

  protected readonly tabsConfig = ErpTabsBuilder.create((b) =>
    b
      .setLayout('horizontal')
      .withSharedState(this.activeTabId)
      .addTab(ROLES_KEYS.detail.tabs.list, 'list', { icon: '@tui.list' })
      .addTab(ROLES_KEYS.detail.tabs.permissions, 'permissions', {
        component: RolePermissionsTabComponent,
        icon: '@tui.key',
      })
      .addTab(ROLES_KEYS.detail.tabs.members, 'members', {
        component: RoleMembersTabComponent,
        icon: '@tui.git-branch',
      })
      .addTab(ROLES_KEYS.detail.tabs.containers, 'containers', {
        component: RoleContainersTabComponent,
        icon: '@tui.arrow-up',
      })
      .addTab(ROLES_KEYS.detail.tabs.holders, 'holders', {
        component: RoleHoldersTabComponent,
        icon: '@tui.users',
      })
      .setInitialValue('list')
      .setOnTabChange(noop),
  );

  public constructor() {
    // Patrz analogiczny komentarz w `UsersComponent` — bez tego zaznaczenie roli, gdy panel jest
    // ręcznie schowany na zakładce 'list', nie miałoby żadnego widocznego efektu.
    effect(() => {
      if (this._store.selectedUuid() && this.activeTabId() === 'list') {
        this.activeTabId.set('permissions');
      }
    });
  }

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
      .fill('content', RolesTabComponent)
      .fill(
        'rightPanel',
        ErpTabsComponent,
        { config: this.tabsConfig, renderMode: 'content' },
        {
          resizable: 'left',
          minWidth: 340,
          maxWidth: 900,
          collapsed: computed(() => this.activeTabId() === 'list' || !this._store.selectedUuid()),
        },
      ),
  );
}
