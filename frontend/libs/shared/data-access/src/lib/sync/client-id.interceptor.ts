import { HttpInterceptorFn } from '@angular/common/http';
import { getOrCreateClientId } from './client-id';

/** Nagłówek czytany przez `ExecutionContextMiddleware` po stronie backendu. */
export const CLIENT_ID_HEADER = 'X-Client-Id';

/**
 * Dokłada identyfikator karty przeglądarki do każdego żądania wychodzącego do NASZYCH
 * mikroserwisów.
 *
 * Bez tego zadanie masowe powstaje z pustym `ClientId`, a powiadomienie o jego zakończeniu
 * leci na kanale `jobs` do grupy SignalR, do której nikt nie należy — użytkownik widzi
 * zadanie „w toku” bez końca, mimo że backend dawno je zamknął.
 *
 * Wyjątek: żądania do Keycloaka (`/protocol/openid-connect/...`, `/.well-known/...`,
 * wysyłane przez `angular-auth-oidc-client`) muszą zostać BEZ tego nagłówka — Keycloak nie ma
 * `X-Client-Id` w swojej białej liście CORS (`Access-Control-Allow-Headers`), więc dołożenie
 * go do żądania spoza naszych serwisów wywala preflight i całe logowanie. Adresy API modułów
 * są konfigurowane per moduł (`remote-api.providers.ts`), więc nie ma tu jednej listy hostów
 * do pozytywnego dopasowania — prościej wykluczyć jedyny znany obcy host niż wymieniać
 * wszystkie własne.
 */
export const erpClientIdInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.includes('/protocol/openid-connect/') || req.url.includes('/.well-known/')) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { [CLIENT_ID_HEADER]: getOrCreateClientId() } }));
};
