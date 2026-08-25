import { HttpInterceptorFn } from '@angular/common/http';
import { currentRequestId } from './request-id';

/** Nagłówek czytany przez `ExecutionContextMiddleware` i pipeline komend po stronie backendu. */
export const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * Dokłada `X-Request-Id` do żądań wysłanych wewnątrz `withRequestId(...)`.
 *
 * <b>Tylko wewnątrz zakresu</b>, a nie do każdego żądania: bez zakresu identyfikator byłby
 * inny przy każdej próbie, więc nie chroniłby przed niczym, a backend zapisywałby wiersz
 * w rejestrze idempotencji dla każdego zapisu w systemie. Nagłówek ma znaczyć „to jest ta sama
 * operacja co poprzednio”, a nie „to jest jakieś żądanie”.
 *
 * Ten sam wyjątek co w `erpClientIdInterceptor`: żądania do Keycloaka zostają bez nagłówka,
 * bo nie ma go na jego białej liście CORS — dołożenie wywaliłoby preflight logowania.
 */
export const erpRequestIdInterceptor: HttpInterceptorFn = (req, next) => {
  const requestId = currentRequestId();

  if (
    !requestId ||
    req.url.includes('/protocol/openid-connect/') ||
    req.url.includes('/.well-known/')
  ) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { [REQUEST_ID_HEADER]: requestId } }));
};
