import { Injectable, Injector, inject } from '@angular/core';
import { Observable, defaultIfEmpty, firstValueFrom } from 'rxjs';
import { TuiDialogService } from '@taiga-ui/core';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { ErpConfirmDialogComponent } from './erp-confirm-dialog.component';
import { ErpConfirmDialogConfig } from './erp-confirm-dialog.types';

/**
 * Jedno wspólne okno potwierdzenia dla wszystkich modułów.
 *
 * <b>Dlaczego w `shared/ui`, a nie w bibliotece modułu.</b> Każdy moduł miał wcześniej własną
 * kopię tego samego opakowania na `TUI_CONFIRM` (`CatalogConfirmDialogService`,
 * `IdentityConfirmDialogService`) — ten sam kod, ta sama pułapka z imperatywnym tłumaczeniem,
 * osobno utrzymywana. Potwierdzenie destrukcyjnej akcji jest elementem języka UI, nie domeny,
 * więc mieszka tam, gdzie reszta atomów. Moduł wnosi wyłącznie klucze tłumaczeń.
 *
 * <b>Wynik.</b> Strumień emituje dokładnie jedną wartość i kończy się: `true` po potwierdzeniu,
 * `false` po anulowaniu **i po zamknięciu oknem/backdropem** — wywołujący nie musi rozróżniać
 * „nie" od „wyszedł bokiem".
 *
 * @example
 * ```ts
 * private readonly _confirm = inject(ErpConfirmDialogService);
 *
 * this._confirm
 *   .confirm(ErpConfirmDialogBuilder.create(b => b.setKeys(PRODUCT_KEYS.base.multimedia.confirm.clearAll, { count }).setDestructive()))
 *   .subscribe(confirmed => { if (confirmed) { ... } });
 * ```
 */
@Injectable({ providedIn: 'root' })
export class ErpConfirmDialogService {
  private readonly _dialogs = inject(TuiDialogService);
  private readonly _injector = inject(Injector);

  public confirm(config: ErpConfirmDialogConfig): Observable<boolean> {
    return this._dialogs
      .open<boolean>(new PolymorpheusComponent(ErpConfirmDialogComponent, this._injector), {
        size: config.size ?? 's',
        // Nagłówek i zamykanie renderuje sam komponent — Taiga nie dokłada swojego paska,
        // bo `label` przyjmuje gotowy tekst, a my chcemy klucz rozwiązywany pipe'em.
        closable: false,
        dismissible: true,
        data: config,
      })
      // Zamknięcie backdropem kończy strumień bez wartości. Dla wywołującego to to samo co „nie".
      .pipe(defaultIfEmpty(false));
  }

  /** Ta sama decyzja dla kodu pisanego na `async/await`. */
  public confirmAsync(config: ErpConfirmDialogConfig): Promise<boolean> {
    return firstValueFrom(this.confirm(config));
  }
}
