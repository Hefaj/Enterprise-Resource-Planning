import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ErpGridLayoutBuilder, ErpGridLayoutComponent } from '@erp/shared/ui';

import { GrantAuditStore } from './grant-audit.store';
import { GrantAuditFilterComponent } from './grant-audit-filter.component';
import { GrantAuditContentComponent } from './grant-audit-content.component';
import { provideGrantAuditTranslations } from './translation';

/**
 * Historia nadań (`grant_audit`) — append-only dziennik audytu: kto/komu/co/kiedy nadał lub
 * odebrał (rola, uprawnienie), skąd (UI/import wsadowy/system). Wyłącznie do odczytu, bez
 * zaznaczeń i akcji masowych — patrz `docs/backend/events-outbox.md`.
 *
 * Zbudowana wg tego samego schematu co pozostałe strony aplikacji (patrz
 * `catalog/feature/.../product/page/product.component.ts`): store strony w providerach,
 * `ErpGridLayout` jako szkielet, panel filtrów po lewej, treść (nagłówek + tabela) w środku.
 * Bez zakładek — w przeciwieństwie do `ProductComponent`/`JobComponent` ten widok ma tylko
 * jedną, płaską listę wpisów.
 */
@Component({
  selector: 'erp-identity-grant-audit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErpGridLayoutComponent],
  providers: [GrantAuditStore, provideGrantAuditTranslations()],
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
export class GrantAuditComponent {
  protected readonly pageConfig = ErpGridLayoutBuilder.create((b) =>
    b
      .setLayoutId('identity-grant-audit-page')
      .setShowBorders(true)
      .setGrid({
        areas: ['filter content'],
        columns: '280px 1fr',
        rows: '1fr',
        gap: '0',
      })
      .fill('filter', GrantAuditFilterComponent)
      .fill('content', GrantAuditContentComponent),
  );
}
