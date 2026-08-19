import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TuiIcon } from '@taiga-ui/core';

import { ErpButtonBuilder, ErpButtonComponent } from '../../atoms/erp-button';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { SHARED_KEYS } from '../../translation/keys';

const AUTH_KEYS = SHARED_KEYS.auth;

/**
 * Strona pokazywana, gdy `erpPermissionGuard` odrzuci nawigację (brak wymaganego
 * uprawnienia) — patrz docs/backend/identity-authz.md §6 Faza 5. Zostaje w chromie appki
 * (trasa-dziecko `ShellLayoutComponent`), nie wylogowuje — to tylko komunikat, prawdziwe
 * egzekwowanie i tak jest po stronie backendu.
 */
@Component({
  selector: 'erp-forbidden',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TuiIcon, ErpButtonComponent, ErpTranslatePipe],
  template: `
    <div class="forbidden">
      <tui-icon
        icon="@tui.shield-alert"
        class="forbidden__icon"
      />
      <h1 class="forbidden__title">{{ AUTH_KEYS.forbidden.title | erpTranslate }}</h1>
      <p class="forbidden__message">{{ AUTH_KEYS.forbidden.message | erpTranslate }}</p>
      <erp-button [config]="backConfig" />
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        block-size: 100%;
        min-block-size: 60dvh;
        padding: 2rem;
      }

      .forbidden {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        max-inline-size: 28rem;
        text-align: center;
      }

      .forbidden__icon {
        inline-size: 3rem;
        block-size: 3rem;
        color: var(--tui-status-negative);
      }

      .forbidden__title {
        margin: 0;
        font: var(--tui-typography-heading-h3);
        color: var(--tui-text-primary);
      }

      .forbidden__message {
        margin: 0;
        font: var(--tui-typography-body-m);
        color: var(--tui-text-secondary);
        text-wrap: pretty;
      }
    `,
  ],
})
export class ErpForbiddenComponent {
  private readonly _router = inject(Router);

  protected readonly AUTH_KEYS = AUTH_KEYS;

  protected readonly backConfig = new ErpButtonBuilder()
    .setLabel(AUTH_KEYS.forbidden.backToDashboard)
    .setAppearance('primary')
    .setFn(async () => {
      await this._router.navigate(['/dashboard']);
    })
    .build();
}
