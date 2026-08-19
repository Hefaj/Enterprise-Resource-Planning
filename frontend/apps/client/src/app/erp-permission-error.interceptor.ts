import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { SHARED_KEYS } from '@erp/shared/ui';
import { ErpToastBridgeService } from './erp-toast-bridge.service';

/**
 * Pokazuje toast, gdy backend odrzuci żądanie z 403 (uprawnienie odebrane po tym, jak front
 * je już pokazał, albo bezpośrednie wywołanie API mimo schowanego przycisku) — patrz
 * docs/backend/identity-authz.md §6 Faza 5: "front tylko chowa UI", więc backend i tak
 * egzekwuje. Celowo **nie wylogowuje** — w odróżnieniu od 401, brak uprawnienia nie znaczy,
 * że sesja jest nieważna.
 *
 * Żyje w hoście (`apps/client`), nie w `@erp/shared/auth` — `type:auth` nie może zależeć od
 * `@erp/shared/ui` (`SHARED_KEYS`/Transloco), a `type:app` (host) może zależeć od obu.
 * Idzie przez `ErpToastBridgeService`, nie przez `TuiAlertService` bezpośrednio —
 * interceptory funkcyjne działają w root `EnvironmentInjector`, a `TuiAlertService` jest
 * dostarczany dopiero na poziomie komponentu `<tui-root>` (patrz `erp-toast-bridge.component.ts`).
 */
export const erpPermissionErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const toastBridge = inject(ErpToastBridgeService);
  const transloco = inject(TranslocoService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 403) {
        toastBridge.show(transloco.translate(SHARED_KEYS.auth.forbidden.toastMessage), 'warning');
      }

      return throwError(() => error);
    }),
  );
};
