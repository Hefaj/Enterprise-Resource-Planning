import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
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
 * Strona `/identity/roles` — dokładnie ten sam szkielet siatki co `ProductComponent`
 * (`frontend/libs/modules/catalog/feature/src/lib/product/page/product.component.ts`).
 *
 * Panel boczny otwiera i zamyka WYŁĄCZNIE wybór zakładki, nigdy zaznaczenie w tabeli
 * (patrz `docs/frontend/pages.md` §3): zakładka `'list'` (bez `component`) to stan
 * "panel schowany", każda kolejna to alternatywny widok otwierany na żądanie —
 * niezależnie od tego, czy i co jest zaznaczone. Za komunikat "nic nie wybrano"
 * odpowiada sama zakładka, nie warunek `collapsed`.
 *
 * Bez kolumny filtru — ról są dziesiątki, wyszukiwanie w tabeli klienckiej wystarcza.
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
  protected readonly activeTabId = signal<string | null>('list');

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
      .fill('content', RolesTabComponent)
      .fill(
        'rightPanel',
        ErpTabsComponent,
        { config: this.tabsConfig, renderMode: 'content' },
        {
          resizable: 'left',
          minWidth: 340,
          maxWidth: 900,
          collapsed: computed(() => this.activeTabId() === 'list'),
        },
      ),
  );
}
