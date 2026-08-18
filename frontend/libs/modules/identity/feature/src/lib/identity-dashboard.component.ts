import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ErpTranslatePipe } from '@erp/shared/ui';
import { IDENTITY_KEYS, provideIdentityTranslations } from './translation';

/**
 * Strona startowa modułu Identity — na razie placeholder. Ekrany właściwe (użytkownicy, role,
 * katalog uprawnień) dojdą w kolejnych iteracjach Fazy 4; ten komponent istnieje głównie po to,
 * żeby routing/menu/federacja miały się do czego podłączyć od pierwszego commita.
 */
@Component({
  selector: 'erp-identity-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErpTranslatePipe],
  providers: [provideIdentityTranslations()],
  template: `
    <div class="dashboard">
      <h1>{{ IDENTITY_KEYS.dashboard.title | erpTranslate }}</h1>
      <p>{{ IDENTITY_KEYS.dashboard.placeholder | erpTranslate }}</p>
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
    `,
  ],
})
export class IdentityDashboardComponent {
  protected readonly IDENTITY_KEYS = IDENTITY_KEYS;
}
