import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ErpFilterComponent, ErpFilterBuilder, ErpFilterConfig } from '@erp/shared/ui';

import { PermissionsStore } from './permissions.store';
import { PERMISSIONS_KEYS } from './translation';

/** Panel filtrów katalogu uprawnień — jedno pole tekstowe (kod/moduł), filtrowanie klient-side
 * (cały katalog jest już załadowany, patrz `PermissionCatalogOrchestrator`). Po lewej, jak na
 * pozostałych stronach modułu (`UsersFilterComponent`). */
@Component({
  selector: 'erp-identity-permissions-filter',
  standalone: true,
  imports: [ErpFilterComponent],
  template: `<erp-filter [config]="filterConfig"></erp-filter>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PermissionsFilterComponent {
  private readonly _store = inject(PermissionsStore);

  private readonly _initialValues = computed(() => ({ search: this._store.search() }));

  public readonly filterConfig: ErpFilterConfig = ErpFilterBuilder.create((b) =>
    b
      .setFilterKey('identity-permissions')
      .setInitialValues(this._initialValues)
      .setOnSearch((val) => this._store.setSearch(val['search'] ?? ''))
      .addFormField('search', 'text', (f) => f.setLabel(PERMISSIONS_KEYS.searchLabel).setIconStart('@tui.search')),
  );
}
