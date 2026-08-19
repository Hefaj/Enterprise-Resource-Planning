import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ErpTranslatePipe } from '@erp/shared/ui';
import { ERP_PERMISSIONS, ErpHasPermissionDirective } from '@erp/shared/auth';
import { IDENTITY_KEYS, provideIdentityTranslations } from './translation';

/**
 * Strona startowa modułu Identity — na razie placeholder. Ekrany właściwe (użytkownicy, role,
 * katalog uprawnień) dojdą w kolejnych iteracjach Fazy 4; ten komponent istnieje głównie po to,
 * żeby routing/menu/federacja miały się do czego podłączyć od pierwszego commita.
 *
 * Sekcja „Zarządzanie rolami" demonstruje `*erpHasPermission` dla całych sekcji (nie tylko
 * pojedynczych przycisków) — patrz docs/backend/identity-authz.md §6 Faza 5.
 */
@Component({
  selector: 'erp-identity-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErpTranslatePipe, ErpHasPermissionDirective],
  providers: [provideIdentityTranslations()],
  template: `
    <div class="dashboard">
      <h1>{{ IDENTITY_KEYS.dashboard.title | erpTranslate }}</h1>
      <p>{{ IDENTITY_KEYS.dashboard.placeholder | erpTranslate }}</p>

      <section
        *erpHasPermission="ERP_PERMISSIONS.Identity.RoleManage"
        class="section"
      >
        <h2>{{ IDENTITY_KEYS.dashboard.roleManagement.title | erpTranslate }}</h2>
        <p>{{ IDENTITY_KEYS.dashboard.roleManagement.placeholder | erpTranslate }}</p>
      </section>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 1.5rem;
      }

      .dashboard h1 {
        font: var(--tui-typography-heading-h3);
        margin: 0 0 0.5rem;
      }

      .dashboard p {
        color: var(--tui-text-secondary);
        margin: 0;
      }

      .section {
        margin-block-start: 1.5rem;
        padding: 1rem;
        border: 1px solid var(--tui-border-normal);
        border-radius: var(--tui-radius-m);
      }

      .section h2 {
        font: var(--tui-typography-heading-h5);
        margin: 0 0 0.375rem;
      }
    `,
  ],
})
export class IdentityDashboardComponent {
  protected readonly IDENTITY_KEYS = IDENTITY_KEYS;
  protected readonly ERP_PERMISSIONS = ERP_PERMISSIONS;
}
