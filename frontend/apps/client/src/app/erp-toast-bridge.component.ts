import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TuiIcon } from '@taiga-ui/core';
import { ErpToastBridgeService, ErpToastRequest } from './erp-toast-bridge.service';

/**
 * Minimalny toast bez `TuiAlertService` — jej konstruktor (`TuiPortal` → `TuiPopupService`)
 * rozwiązuje się tylko w kontekście wewnętrznego `<tui-popups>` z szablonu `TuiRoot`, a
 * content projection (`<ng-content>`, czyli m.in. `<router-outlet>` i ten komponent w
 * `app.html`) dostaje injector z miejsca DEKLARACJI (`App`), nie z pozycji w drzewie DOM —
 * więc żaden kod poza `TuiRoot`'em nie widzi `TuiPopupService` (`NG0201`). Prosty,
 * samodzielny banerek stylowany tokenami `--tui-*` omija ten problem bez grzebania w
 * wewnętrznym API TaigaUI.
 */
@Component({
  selector: 'app-toast-bridge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TuiIcon],
  template: `
    @if (current(); as toast) {
      <div
        class="toast"
        [class.toast--warning]="toast.appearance === 'warning'"
        [class.toast--negative]="toast.appearance === 'negative'"
        role="alert"
      >
        <tui-icon icon="@tui.triangle-alert" />
        <span>{{ toast.message }}</span>
      </div>
    }
  `,
  styles: [
    `
      :host {
        position: fixed;
        inset-block-end: 1.5rem;
        inset-inline-end: 1.5rem;
        z-index: 1000;
        pointer-events: none;
      }

      .toast {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        max-inline-size: 24rem;
        padding: 0.75rem 1rem;
        border-radius: var(--tui-radius-m);
        background: var(--tui-status-negative-pale);
        border: 1px solid var(--tui-status-negative);
        color: var(--tui-text-primary);
        font: var(--tui-typography-body-s);
        box-shadow: var(--tui-shadow-medium);
        pointer-events: auto;
      }

      .toast--negative {
        background: var(--tui-status-negative-pale);
        border-color: var(--tui-status-negative);
      }
    `,
  ],
})
export class ErpToastBridgeComponent {
  private readonly _bridge = inject(ErpToastBridgeService);

  protected readonly current = signal<ErpToastRequest | null>(null);

  public constructor() {
    this._bridge.requests$.subscribe((toast) => {
      this.current.set(toast);
      setTimeout(() => {
        if (this.current() === toast) {
          this.current.set(null);
        }
      }, 5000);
    });
  }
}
