import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ErpTranslatePipe } from '@erp/shared/ui';

import { GrantAuditStore } from '../grant-audit.store';
import { IdentityGrantAuditTableComponent } from '../components/identity-grant-audit-table/identity-grant-audit-table.component';
import { IDENTITY_KEYS } from '../../translation';

/**
 * Treść obszaru "content" siatki strony: nagłówek (tytuł/podtytuł) + tabela dziennika audytu.
 * Bez paska akcji — dziennik jest wyłącznie do odczytu, bez zaznaczeń i operacji masowych
 * (patrz `docs/backend/events-outbox.md`).
 */
@Component({
  selector: 'erp-identity-grant-audit-content',
  standalone: true,
  imports: [ErpTranslatePipe, IdentityGrantAuditTableComponent],
  template: `
    <div class="flex flex-col h-full w-full min-h-0 gap-3 p-4">
      <div class="flex flex-col gap-1">
        <h1 class="page-title">{{ IDENTITY_KEYS.grantAudit.title | erpTranslate }}</h1>
        <p class="page-subtitle">{{ IDENTITY_KEYS.grantAudit.subtitle | erpTranslate }}</p>
      </div>

      <div class="flex-1 min-h-0">
        <erp-identity-grant-audit-table
          stateKey="identity-grant-audit"
          [filters]="store.filters()"
          (loadingChange)="store.setLoading($event)"
        />
      </div>
    </div>
  `,
  styles: [
    `
      .page-title {
        font: var(--tui-typography-heading-h3);
        margin: 0;
      }

      .page-subtitle {
        color: var(--tui-text-secondary);
        margin: 0;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrantAuditContentComponent {
  protected readonly IDENTITY_KEYS = IDENTITY_KEYS;
  protected readonly store = inject(GrantAuditStore);
}
