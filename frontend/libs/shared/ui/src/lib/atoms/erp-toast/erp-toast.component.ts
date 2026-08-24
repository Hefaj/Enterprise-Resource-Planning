import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpToastAppearance, ErpToastConfig } from './erp-toast.types';

/**
 * Pojedynczy toast — komponent czysto prezentacyjny.
 *
 * <b>Dlaczego własny banerek, a nie `TuiAlertService`.</b> Konstruktor tamtego
 * (`TuiPortal` → `TuiPopupService`) rozwiązuje się wyłącznie w kontekście wewnętrznego
 * `<tui-popups>` z szablonu `TuiRoot`. Content projection (`<ng-content>`, czyli m.in.
 * `<router-outlet>`) dostaje injector z miejsca DEKLARACJI, nie z pozycji w drzewie DOM,
 * więc każda próba wstrzyknięcia go poza `TuiRoot` kończy się `NG0201`. Samodzielny banerek
 * stylowany tokenami `--tui-*` omija to bez grzebania w wewnętrznym API TaigaUI.
 *
 * Kolejkowaniem, cyklem życia i tłumaczeniem zajmuje się wyżej — tutaj jest tylko wygląd.
 */
@Component({
  selector: 'erp-toast',
  standalone: true,
  imports: [TuiButton, TuiIcon, ErpTranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="toast"
      [class.toast--info]="_appearance() === 'info'"
      [class.toast--positive]="_appearance() === 'positive'"
      [class.toast--warning]="_appearance() === 'warning'"
      [class.toast--negative]="_appearance() === 'negative'"
      [attr.role]="_role()"
    >
      <tui-icon [icon]="_icon()" class="toast__icon" />

      <span class="toast__message">{{ _message() | erpTranslate }}</span>

      @if (config().action; as action) {
        <button
          tuiButton
          type="button"
          appearance="flat"
          size="xs"
          class="toast__action"
          [disabled]="_running()"
          (click)="runAction()"
        >
          {{ action.label | erpTranslate }}
        </button>
      }

      <button
        tuiIconButton
        type="button"
        appearance="flat"
        size="xs"
        class="toast__close"
        [attr.aria-label]="'close'"
        (click)="closed.emit()"
      >
        <tui-icon icon="@tui.x" />
      </button>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        pointer-events: auto;
      }

      .toast {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        max-inline-size: 26rem;
        padding: 0.75rem 0.75rem 0.75rem 1rem;
        border-radius: var(--tui-radius-m);
        border: 1px solid var(--tui-border-normal);
        background: var(--tui-background-elevation-2);
        color: var(--tui-text-primary);
        font: var(--tui-font-text-s);
        box-shadow: var(--tui-shadow-medium);
      }

      .toast__icon {
        flex-shrink: 0;
      }

      .toast__message {
        flex: 1 1 auto;
        min-inline-size: 0;
        word-break: break-word;
      }

      .toast__action,
      .toast__close {
        flex-shrink: 0;
      }

      .toast--info {
        border-color: var(--tui-background-accent-1);
      }
      .toast--info .toast__icon {
        color: var(--tui-background-accent-1);
      }

      .toast--positive {
        border-color: var(--tui-status-positive);
        background: var(--tui-status-positive-pale);
      }
      .toast--positive .toast__icon {
        color: var(--tui-status-positive);
      }

      .toast--warning {
        border-color: var(--tui-status-warning);
        background: var(--tui-status-warning-pale);
      }
      .toast--warning .toast__icon {
        color: var(--tui-status-warning);
      }

      .toast--negative {
        border-color: var(--tui-status-negative);
        background: var(--tui-status-negative-pale);
      }
      .toast--negative .toast__icon {
        color: var(--tui-status-negative);
      }
    `,
  ],
})
export class ErpToastComponent {
  public readonly config = input.required<ErpToastConfig>();

  /** Użytkownik zamknął toast krzyżykiem. */
  public readonly closed = output<void>();

  /** Akcja jest w toku — blokuje przycisk, żeby jedno kliknięcie nie zamieniło się w pięć. */
  protected readonly _running = signal(false);

  /** `MaybeSignal` rozpakowane do zwykłej wartości — pipe tłumaczeń nie przyjmuje sygnałów. */
  protected readonly _message = computed(() => unwrapSignal(this.config().message));

  protected readonly _appearance = computed<ErpToastAppearance>(
    () => unwrapSignal(this.config().appearance) ?? 'info',
  );

  protected readonly _icon = computed(() => {
    const explicit = unwrapSignal(this.config().icon);
    if (explicit) {
      return explicit;
    }

    switch (this._appearance()) {
      case 'positive':
        return '@tui.circle-check';
      case 'warning':
        return '@tui.triangle-alert';
      case 'negative':
        return '@tui.circle-x';
      default:
        return '@tui.info';
    }
  });

  /**
   * `alert` przerywa czytnikowi ekranu w pół zdania — należy się temu, co poszło źle.
   * Potwierdzenie zapisu ma być przeczytane, gdy użytkownik skończy bieżącą myśl, czyli `status`.
   */
  protected readonly _role = computed(() =>
    this._appearance() === 'negative' || this._appearance() === 'warning' ? 'alert' : 'status',
  );

  protected async runAction(): Promise<void> {
    const action = this.config().action;
    if (!action || this._running()) {
      return;
    }

    this._running.set(true);

    try {
      await action.fn();
    } finally {
      this._running.set(false);
    }
  }
}
