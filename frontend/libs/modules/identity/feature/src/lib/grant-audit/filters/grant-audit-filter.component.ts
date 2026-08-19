import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ErpFilterComponent, ErpFilterBuilder, ErpFilterConfig } from '@erp/shared/ui';
import { SearchGrantAuditRequest } from '@erp/identity/data-access';

import { GrantAuditStore } from '../grant-audit.store';
import { IDENTITY_KEYS } from '../../translation';

/**
 * Panel filtrów dziennika audytu — świadomie ograniczony do pól, które backend faktycznie
 * filtruje (`SearchGrantAuditRequest`: `subjectUuid`/`subjectType`/`action`, patrz
 * `Identity.Application/Audit/GrantAuditDto.cs`). Bez presetów/zaznaczeń — to prosty,
 * tylko-do-odczytu dziennik, nie potrzebuje maszynerii `ProductFilterComponent`.
 */
@Component({
  selector: 'erp-identity-grant-audit-filter',
  standalone: true,
  imports: [ErpFilterComponent],
  template: `
    <erp-filter [config]="filterConfig"></erp-filter>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrantAuditFilterComponent {
  private readonly _store = inject(GrantAuditStore);

  private readonly _initialValues = computed(() => this._store.filters());

  public readonly filterConfig: ErpFilterConfig = ErpFilterBuilder.create((b) =>
    b
      .setFilterKey('identity-grant-audit')
      .setInitialValues(this._initialValues)
      .setOnSearch((val) => this.onSearch(val))
      .setLoading(this._store.loading)
      .addFormField('subjectUuid', 'text', (f) =>
        f
          .setLabel(IDENTITY_KEYS.grantAudit.filters.subjectUuid.label)
          .setPlaceholder(IDENTITY_KEYS.grantAudit.filters.subjectUuid.placeholder),
      )
      .addFormField('subjectType', 'text', (f) =>
        f
          .setLabel(IDENTITY_KEYS.grantAudit.filters.subjectType.label)
          .setPlaceholder(IDENTITY_KEYS.grantAudit.filters.subjectType.placeholder),
      )
      .addFormField('action', 'text', (f) =>
        f
          .setLabel(IDENTITY_KEYS.grantAudit.filters.action.label)
          .setPlaceholder(IDENTITY_KEYS.grantAudit.filters.action.placeholder),
      ),
  );

  public onSearch(filters: Partial<SearchGrantAuditRequest>): void {
    this._store.updateFilters(filters);
  }
}
