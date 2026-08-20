import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import {
  ErpGridLayoutBuilder,
  ErpGridLayoutComponent,
  ErpTabsBuilder,
  ErpTabsComponent,
} from '@erp/shared/ui';
import { noop } from 'rxjs';

import { PermissionsFilterComponent } from './filters/permissions-filter.component';
import { PermissionsCatalogListComponent } from './content/permissions-catalog-list.component';
import { PermissionHoldersTabComponent } from './content/side-panel/holders/permission-holders-tab.component';
import { PermissionsStore } from './permissions.store';
import { providePermissionsTranslations, PERMISSIONS_KEYS } from '../translation';

/** Strona `/identity/permissions` — read-only przeglądarka katalogu uprawnień (grupowanie po
 * module, filtr po lewej) + panel "kto ma to uprawnienie" dla wybranego kodu. Zero mutacji —
 * katalog jest definiowany w kodzie, nie CRUD-owany w UI (patrz
 * `docs/backend/identity-authz.md` §3).
 *
 * Panel boczny otwiera i zamyka WYŁĄCZNIE wybór zakładki, nigdy zaznaczenie w liście
 * (patrz `docs/frontend/pages.md` §3): zakładka `'list'` (bez `component`) to stan
 * "panel schowany", zakładka "Kto ma uprawnienie" to alternatywny widok otwierany na żądanie —
 * niezależnie od tego, czy jakiś kod jest wybrany. Komunikat "nic nie wybrano" pokazuje sam
 * panel, nie warunek `collapsed`. */
@Component({
  selector: 'erp-identity-permissions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErpGridLayoutComponent],
  providers: [PermissionsStore, providePermissionsTranslations()],
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
export class PermissionsComponent {
  protected readonly activeTabId = signal<string | null>('list');

  protected readonly tabsConfig = ErpTabsBuilder.create((b) =>
    b
      .setLayout('horizontal')
      .withSharedState(this.activeTabId)
      .addTab(PERMISSIONS_KEYS.tabs.list, 'list', { icon: '@tui.list' })
      .addTab(PERMISSIONS_KEYS.tabs.holders, 'holders', {
        component: PermissionHoldersTabComponent,
        icon: '@tui.users',
      })
      .setOnTabChange(noop),
  );

  protected readonly pageConfig = ErpGridLayoutBuilder.create((b) =>
    b
      .setLayoutId('identity-permissions-page')
      .setShowBorders(true)
      .setGrid({
        areas: ['filter tabs    tabs', 'filter content rightPanel'],
        columns: '280px 1fr 420px',
        rows: 'auto 1fr',
        gap: '0',
      })
      .fill('filter', PermissionsFilterComponent)
      .fill('tabs', ErpTabsComponent, { config: this.tabsConfig, renderMode: 'tabs' })
      .fill('content', PermissionsCatalogListComponent)
      .fill(
        'rightPanel',
        ErpTabsComponent,
        { config: this.tabsConfig, renderMode: 'content' },
        {
          resizable: 'left',
          minWidth: 320,
          maxWidth: 800,
          collapsed: computed(() => this.activeTabId() === 'list'),
        },
      ),
  );
}
