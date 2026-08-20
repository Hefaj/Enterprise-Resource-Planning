import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ErpFilterComponent, ErpFilterBuilder, ErpFilterConfig } from '@erp/shared/ui';
import { SearchUserAccountRequest } from '@erp/identity/data-access';

import { UsersStore } from '../users.store';
import { USERS_KEYS } from '../../translation';

/** Panel filtrów listy użytkowników — jedyne pole filtrowalne przez backend to `email`
 * (`SearchUserAccountRequest`), patrz `frontend/libs/modules/identity/data-access`. */
@Component({
  selector: 'erp-identity-users-filter',
  standalone: true,
  imports: [ErpFilterComponent],
  template: `<erp-filter [config]="filterConfig"></erp-filter>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersFilterComponent {
  private readonly _store = inject(UsersStore);

  private readonly _initialValues = computed(() => this._store.filters());

  public readonly filterConfig: ErpFilterConfig = ErpFilterBuilder.create((b) =>
    b
      .setFilterKey('identity-users')
      .setInitialValues(this._initialValues)
      .setOnSearch((val) => this.onSearch(val))
      .setLoading(this._store.loading)
      .addFormField('email', 'text', (f) => f.setLabel(USERS_KEYS.filters.email.label).setPlaceholder(USERS_KEYS.filters.email.placeholder)),
  );

  public onSearch(filters: Partial<SearchUserAccountRequest>): void {
    this._store.updateFilters(filters);
  }
}
