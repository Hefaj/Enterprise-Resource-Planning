import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ErpGridLayoutBuilder, ErpGridLayoutComponent, ErpTabsBuilder, ErpTabsComponent } from '@erp/shared/ui';
import { noop } from 'rxjs';

import { UsersStore } from './users.store';
import { UsersFilterComponent } from './users-filter.component';
import { UsersContentComponent } from './users-content.component';
import { UserRolesTabComponent } from './tabs/user-roles-tab.component';
import { UserPermissionsTabComponent } from './tabs/user-permissions-tab.component';
import { UserEffectivePermissionsTabComponent } from './tabs/user-effective-permissions-tab.component';
import { provideUsersTranslations } from './translation';
import { USERS_KEYS } from './translation';

/**
 * Strona `/identity/users` — dokładnie ten sam szkielet siatki co `ProductComponent`
 * (`frontend/libs/modules/catalog/feature/src/lib/product/page/product.component.ts`):
 * filtr po lewej, poziomy pasek zakładek nad treścią, stała lista w `content`, a zakładki
 * (Lista/Role/Uprawnienia bezpośrednie/Efektywne uprawnienia) renderowane w `rightPanel` —
 * przeciągalnym (`resizable: 'left'`) i chowanym. Pierwsza zakładka (`'list'`) to — tak jak
 * `'products'` w `ProductComponent` — zakładka bez `component` (patrz `docs/frontend/pages.md`
 * §3 pkt 1): jej „treścią" jest sąsiedni obszar `content`, a jej jedyna rola to dać użytkownikowi
 * sposób na ręczne schowanie panelu bocznego bez utraty zaznaczenia. Panel chowa się więc w
 * dwóch sytuacjach: gdy ta zakładka jest aktywna ALBO gdy nic nie jest zaznaczone.
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
  private readonly _store = inject(UsersStore);

  protected readonly activeTabId = signal<string | null>(null);

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
      .setInitialValue('list')
      .setOnTabChange(noop),
  );

  public constructor() {
    // Wybranie wiersza, gdy panel jest ręcznie schowany na zakładce 'list', przełącza z powrotem
    // na pierwszą zakładkę szczegółu — inaczej zaznaczenie użytkownika nie miałoby żadnego
    // widocznego efektu (warunek `collapsed` zostałby prawdziwy przez samo `activeTabId() === 'list'`).
    effect(() => {
      if (this._store.selectedUuid() && this.activeTabId() === 'list') {
        this.activeTabId.set('roles');
      }
    });
  }

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
          // Treść panelu zależy od `selectedUuid` (dokładnie JEDEN zaznaczony wiersz) — patrz
          // `UsersStore.selectedUuid` — więc chowa się także wtedy, gdy zaznaczono zero, wiele
          // wierszy albo tryb `query`, nie tylko na zakładce-liście.
          collapsed: computed(() => this.activeTabId() === 'list' || !this._store.selectedUuid()),
        },
      ),
  );
}
