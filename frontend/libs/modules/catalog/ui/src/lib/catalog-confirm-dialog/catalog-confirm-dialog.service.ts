import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { TuiDialogService } from '@taiga-ui/core';
import { TUI_CONFIRM } from '@taiga-ui/kit';
import { TranslocoService } from '@jsverse/transloco';

/**
 * Klucze zdania potwierdzenia. Surowe stringi z rejestru tłumaczeń modułu — atom nie zna
 * dziedziny, a smart component nie zna sposobu renderowania dialogu.
 */
export interface CatalogConfirmKeys {
  title: string;
  message: string;
  yes: string;
  no: string;
}

/**
 * Potwierdzanie akcji destrukcyjnych w module Catalog (odpięcie multimediów, wyczyszczenie
 * galerii). Repo nie ma własnego atomu confirm-dialog, więc opakowujemy `TUI_CONFIRM` wprost
 * z Taiga UI — tak samo jak `IdentityConfirmDialogService` po stronie uprawnień.
 *
 * <b>Dlaczego tłumaczenie idzie przez `TranslocoService`, a nie przez pipe.</b>
 * `TuiDialogService.open` renderuje komponent Taigi z gotowym tekstem w `data`, więc szablonu,
 * w którym mógłby stanąć `erpTranslate`, tu po prostu nie ma. Ten sam wzorzec co
 * w `erp-permission-error.interceptor.ts`.
 *
 * <b>Parametry zdania.</b> Liczby (ile plików, ilu produktów dotknie operacja) przechodzą jako
 * `params` do interpolacji — potwierdzenie bez liczby nie mówi użytkownikowi tego, co powinno:
 * jaki jest promień rażenia.
 */
@Injectable({ providedIn: 'root' })
export class CatalogConfirmDialogService {
  private readonly _dialogs = inject(TuiDialogService);
  private readonly _transloco = inject(TranslocoService);

  public confirm(keys: CatalogConfirmKeys, params?: Record<string, unknown>): Observable<boolean> {
    return this._dialogs.open<boolean>(TUI_CONFIRM, {
      label: this._transloco.translate(keys.title),
      size: 's',
      data: {
        content: this._transloco.translate(keys.message, params),
        yes: this._transloco.translate(keys.yes),
        no: this._transloco.translate(keys.no),
      },
    });
  }
}
