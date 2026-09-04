import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ErpToastService, SHARED_KEYS } from '@erp/shared/ui';

/**
 * Pokazuje toast, gdy backend odrzuci żądanie z 403 (uprawnienie odebrane po tym, jak front
 * je już pokazał, albo bezpośrednie wywołanie API mimo schowanego przycisku) — patrz
 * docs/architecture/security.md §6 Faza 5: "front tylko chowa UI", więc backend i tak
 * egzekwuje. Celowo **nie wylogowuje** — w odróżnieniu od 401, brak uprawnienia nie znaczy,
 * że sesja jest nieważna.
 *
 * Żyje w hoście (`apps/client`), nie w `@erp/shared/auth` — `type:auth` nie może zależeć od
 * `@erp/shared/ui` (`SHARED_KEYS`), a `type:app` (host) może zależeć od obu.
 *
 * Do serwisu toastów idzie sam KLUCZ tłumaczenia, nie gotowy tekst: przetłumaczenie tutaj
 * zamroziłoby język w chwili wystrzelenia, więc przełączenie języka nie odświeżyłoby
 * widocznego komunikatu (patrz `ErpToastConfig.message`).
 */
export const erpPermissionErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const toasts = inject(ErpToastService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 403) {
        toasts.show({
          message: SHARED_KEYS.auth.forbidden.toastMessage,
          appearance: 'warning',
        });
      }

      return throwError(() => error);
    }),
  );
};
