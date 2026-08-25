import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TuiDialogContext, TuiIcon } from '@taiga-ui/core';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import { ErpButtonComponent } from '../erp-button/erp-button.component';
import { ErpButtonConfig } from '../erp-button/erp-button.types';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { SHARED_KEYS } from '../../translation';
import { ErpConfirmAppearance, ErpConfirmDialogConfig } from './erp-confirm-dialog.types';

/**
 * Zawartość okna potwierdzenia — komponent czysto prezentacyjny, otwierany przez
 * `ErpConfirmDialogService`. Wynik oddaje przez kontekst dialogu Taigi.
 *
 * <b>Dlaczego własne okno, a nie `TUI_CONFIRM`.</b> `TUI_CONFIRM` przyjmuje gotowe **teksty**
 * w `data`, więc każdy wywołujący musiał tłumaczyć imperatywnie przez `TranslocoService`
 * (tak robiły modułowe `CatalogConfirmDialogService`/`IdentityConfirmDialogService`). To
 * zamraża język w chwili otwarcia i łamie regułę „atomy są translation-aware" — tu klucz
 * rozwiązuje pipe `erpTranslate` w szablonie, jak w każdym innym atomie. Przy okazji dochodzi
 * to, czego `TUI_CONFIRM` nie ma: wydźwięk destrukcyjny, lista skutków i spinner na przycisku.
 *
 * Komponent **nie deklaruje** providerów Transloco — to by przesłoniło scope modułu, z którego
 * dialog został otwarty (patrz docs/frontend/translations.md §2). Klucze modułowe są pełne
 * (`product.base....`), więc rozwiązują się przez globalny serwis.
 */
@Component({
  selector: 'erp-confirm-dialog',
  standalone: true,
  imports: [TuiIcon, ErpButtonComponent, ErpTranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="confirm" [attr.role]="'alertdialog'">
      <div class="confirm__head">
        <span class="confirm__badge" [class]="'confirm__badge--' + _appearance()">
          <tui-icon [icon]="_icon()" />
        </span>

        <h2 class="confirm__title">{{ _title() | erpTranslate }}</h2>
      </div>

      <p class="confirm__message">{{ _message() | erpTranslate }}</p>

      @if (_details().length) {
        <ul class="confirm__details">
          @for (detail of _details(); track $index) {
            <li>{{ detail | erpTranslate }}</li>
          }
        </ul>
      }

      <div class="confirm__footer">
        <erp-button [config]="_cancelButton()" />
        <erp-button [config]="_confirmButton()" />
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .confirm {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .confirm__head {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .confirm__badge {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        inline-size: 2.25rem;
        block-size: 2.25rem;
        border-radius: 50%;
        background: var(--tui-background-neutral-1);
        color: var(--tui-text-primary);
      }

      .confirm__badge--warning {
        background: var(--tui-status-warning-pale);
        color: var(--tui-status-warning);
      }

      .confirm__badge--destructive {
        background: var(--tui-status-negative-pale);
        color: var(--tui-status-negative);
      }

      .confirm__title {
        margin: 0;
        font: var(--tui-font-heading-6);
        color: var(--tui-text-primary);
      }

      .confirm__message {
        margin: 0;
        font: var(--tui-font-text-m);
        color: var(--tui-text-secondary);
      }

      .confirm__details {
        margin: 0;
        padding-inline-start: 1.25rem;
        font: var(--tui-font-text-s);
        color: var(--tui-text-secondary);
      }

      .confirm__footer {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-block-start: 0.5rem;
      }
    `,
  ],
})
export class ErpConfirmDialogComponent {
  private readonly _context =
    inject<TuiDialogContext<boolean, ErpConfirmDialogConfig>>(POLYMORPHEUS_CONTEXT);

  /** Akcja z `onConfirm` jest w toku — blokuje oba przyciski, żeby jedno kliknięcie nie stało się pięcioma. */
  private readonly _running = signal(false);

  protected readonly _title = computed(() => unwrapSignal(this._context.data.title));

  protected readonly _message = computed(() => unwrapSignal(this._context.data.message));

  protected readonly _details = computed(() => unwrapSignal(this._context.data.details) ?? []);

  protected readonly _appearance = computed<ErpConfirmAppearance>(
    () => unwrapSignal(this._context.data.appearance) ?? 'neutral',
  );

  protected readonly _icon = computed(() => {
    const explicit = unwrapSignal(this._context.data.icon);
    if (explicit) {
      return explicit;
    }

    switch (this._appearance()) {
      case 'destructive':
        return '@tui.triangle-alert';
      case 'warning':
        return '@tui.circle-alert';
      default:
        return '@tui.circle-help';
    }
  });

  protected readonly _confirmButton = computed<ErpButtonConfig>(() => ({
    label: unwrapSignal(this._context.data.confirmLabel) ?? SHARED_KEYS.confirm.confirm,
    appearance: this._appearance() === 'destructive' ? 'destructive' : 'primary',
    loading: this._running(),
    disabled: this._running(),
    fn: () => this._accept(),
  }));

  protected readonly _cancelButton = computed<ErpButtonConfig>(() => ({
    label: unwrapSignal(this._context.data.cancelLabel) ?? SHARED_KEYS.confirm.cancel,
    appearance: 'flat',
    disabled: this._running(),
    fn: () => this._reject(),
  }));

  /**
   * Gdy konfiguracja niesie `onConfirm`, okno zostaje otwarte na czas akcji ze spinnerem —
   * użytkownik widzi postęp tam, gdzie kliknął. Błąd akcji zamyka dialog wynikiem `false`
   * i wędruje dalej: to wywołujący (a nie okno) wie, jak go pokazać.
   */
  private async _accept(): Promise<void> {
    const action = this._context.data.onConfirm;

    if (!action) {
      this._context.completeWith(true);
      return;
    }

    if (this._running()) {
      return;
    }

    this._running.set(true);

    try {
      await action();
      this._context.completeWith(true);
    } catch (error) {
      this._context.completeWith(false);
      throw error;
    } finally {
      this._running.set(false);
    }
  }

  private _reject(): void {
    if (this._running()) {
      return;
    }

    this._context.completeWith(false);
  }
}
