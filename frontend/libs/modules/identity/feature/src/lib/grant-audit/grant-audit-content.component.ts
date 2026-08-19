import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { GrantAuditStore } from './grant-audit.store';
import { IdentityGrantAuditTableComponent } from './components/identity-grant-audit-table/identity-grant-audit-table.component';

/**
 * Treść obszaru "content" siatki strony: tabela dziennika audytu. Bez paska akcji — dziennik
 * jest wyłącznie do odczytu, bez zaznaczeń i operacji masowych (patrz
 * `docs/backend/events-outbox.md`).
 */
@Component({
  selector: 'erp-identity-grant-audit-content',
  standalone: true,
  imports: [IdentityGrantAuditTableComponent],
  template: `
    <div class="flex flex-col h-full w-full min-h-0 gap-3 p-4">
      <div class="flex-1 min-h-0">
        <erp-identity-grant-audit-table
          stateKey="identity-grant-audit"
          [filters]="store.filters()"
          (loadingChange)="store.setLoading($event)"
        />
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrantAuditContentComponent {
  protected readonly store = inject(GrantAuditStore);
}
