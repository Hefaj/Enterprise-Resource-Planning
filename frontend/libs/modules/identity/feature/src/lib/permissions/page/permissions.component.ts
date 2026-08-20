import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ErpGridLayoutBuilder, ErpGridLayoutComponent } from '@erp/shared/ui';

import { PermissionsStore } from './permissions.store';
import { PermissionsFilterComponent } from './filters/permissions-filter.component';
import { PermissionsCatalogListComponent } from './content/permissions-catalog-list.component';
import { PermissionHoldersPanelComponent } from './content/side-panel/holders/permission-holders-panel.component';
import { providePermissionsTranslations } from '../translation';

/** Strona `/identity/permissions` — read-only przeglądarka katalogu uprawnień (grupowanie po
 * module, filtr po lewej) + panel "kto ma to uprawnienie" dla wybranego kodu, przeciągalny i
 * chowany, gdy nic nie jest zaznaczone (jak `rightPanel` na pozostałych stronach modułu). Zero
 * mutacji — katalog jest definiowany w kodzie, nie CRUD-owany w UI (patrz
 * `docs/backend/identity-authz.md` §3). */
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
  private readonly _store = inject(PermissionsStore);

  protected readonly pageConfig = ErpGridLayoutBuilder.create((b) =>
    b
      .setLayoutId('identity-permissions-page')
      .setShowBorders(true)
      .setGrid({
        areas: ['filter content rightPanel'],
        columns: '280px 1fr 420px',
        rows: '1fr',
        gap: '0',
      })
      .fill('filter', PermissionsFilterComponent)
      .fill('content', PermissionsCatalogListComponent)
      .fill(
        'rightPanel',
        PermissionHoldersPanelComponent,
        {},
        {
          resizable: 'left',
          minWidth: 320,
          maxWidth: 800,
          collapsed: computed(() => !this._store.selectedCode()),
        },
      ),
  );
}
