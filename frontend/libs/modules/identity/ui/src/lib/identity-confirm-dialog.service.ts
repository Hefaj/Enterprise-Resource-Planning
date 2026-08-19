import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { TuiDialogService } from '@taiga-ui/core';
import { TUI_CONFIRM } from '@taiga-ui/kit';
import { TranslocoService } from '@jsverse/transloco';

/**
 * Mały wspólny helper do potwierdzania destrukcyjnych akcji (odbierz rolę/uprawnienie, usuń
 * rolę składową) — repo nie ma własnego atomu confirm-dialog, więc opakowujemy `TUI_CONFIRM`
 * bezpośrednio z Taiga UI (patrz `.agents/skills/taiga-ui/SKILL.md` §Dialogs). Klucze tłumaczeń
 * są tłumaczone imperatywnie przez `TranslocoService.translate` (wzorzec z
 * `erp-permission-error.interceptor.ts`), bo `TuiDialogService.open` nie renderuje przez pipe.
 */
@Injectable({ providedIn: 'root' })
export class IdentityConfirmDialogService {
  private readonly _dialogs = inject(TuiDialogService);
  private readonly _transloco = inject(TranslocoService);

  public confirm(keys: { title: string; message: string; yes: string; no: string }): Observable<boolean> {
    return this._dialogs.open<boolean>(TUI_CONFIRM, {
      label: this._transloco.translate(keys.title),
      size: 's',
      data: {
        content: this._transloco.translate(keys.message),
        yes: this._transloco.translate(keys.yes),
        no: this._transloco.translate(keys.no),
      },
    });
  }
}
