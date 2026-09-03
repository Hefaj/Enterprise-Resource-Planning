import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { ErpFilterComponent, ErpFilterBuilder, ErpFilterConfig, injectTranslationsReadySignal } from '@erp/shared/ui';
import { SearchUserAccountRequest } from '@erp/identity/data-access';
import { USER_ACCOUNT_KIND } from '@erp/identity/util';

import { UsersStore } from '../users.store';
import { USERS_KEYS } from '../../translation';

/** Pozycja pickera `kind` — etykieta już przetłumaczona, bo `erp-input-picker` pokazuje wartość
 * pola, nie klucz (ten sam wzorzec co picker `scope` w `issue-filter.component.ts`). */
interface FilterOption {
  readonly value: number;
  readonly label: string;
}

/** Panel filtrów listy użytkowników. Pola filtrowalne przez backend: `email` i `kind`
 * (`SearchUserAccountRequest`, patrz `frontend/libs/modules/identity/data-access`). Domyślny
 * filtr strony (`UsersStore`) jest `kind = Human` — picker pozwala go wyczyścić i zobaczyć też
 * konta serwisowe (klucze integracyjne, API-003). */
@Component({
  selector: 'erp-identity-users-filter',
  standalone: true,
  imports: [ErpFilterComponent],
  template: `<erp-filter [config]="filterConfig"></erp-filter>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersFilterComponent {
  private readonly _store = inject(UsersStore);
  private readonly _transloco = inject(TranslocoService);
  private readonly _translationsReady = injectTranslationsReadySignal();

  private readonly _initialValues = computed(() => this._store.filters());

  private readonly _kindOptions = computed<FilterOption[]>(() => {
    this._translationsReady();
    return [
      { value: USER_ACCOUNT_KIND.Human, label: this._transloco.translate(USERS_KEYS.filters.kind.human) },
      { value: USER_ACCOUNT_KIND.Service, label: this._transloco.translate(USERS_KEYS.filters.kind.service) },
    ];
  });

  public readonly filterConfig: ErpFilterConfig = ErpFilterBuilder.create((b) =>
    b
      .setFilterKey('identity-users')
      .setInitialValues(this._initialValues)
      .setOnSearch((val) => this.onSearch(val))
      .setLoading(this._store.loading)
      .addFormField('email', 'text', (f) => f.setLabel(USERS_KEYS.filters.email.label).setPlaceholder(USERS_KEYS.filters.email.placeholder))
      .addFormField('kind', 'inputPicker', (f) =>
        f
          .setLabel(USERS_KEYS.filters.kind.label)
          .setItems(this._kindOptions)
          .setLabelKey('label')
          .setValueKey('value')
          .setStrategy('single'),
      ),
  );

  public onSearch(filters: Partial<SearchUserAccountRequest>): void {
    this._store.updateFilters(filters);
  }
}
