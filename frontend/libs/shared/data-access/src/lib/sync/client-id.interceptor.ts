import { HttpInterceptorFn } from '@angular/common/http';
import { getOrCreateClientId } from './client-id';

/** Nagłówek czytany przez `ExecutionContextMiddleware` po stronie backendu. */
export const CLIENT_ID_HEADER = 'X-Client-Id';

/**
 * Dokłada identyfikator karty przeglądarki do każdego żądania wychodzącego.
 *
 * Bez tego zadanie masowe powstaje z pustym `ClientId`, a powiadomienie o jego zakończeniu
 * leci na kanale `jobs` do grupy SignalR, do której nikt nie należy — użytkownik widzi
 * zadanie „w toku” bez końca, mimo że backend dawno je zamknął.
 *
 * Interceptor jest bezwarunkowy: adresy API modułów są konfigurowane per moduł
 * (`remote-api.providers.ts`), więc nie ma tu jednej listy hostów, do której dałoby się
 * sensownie ograniczyć nagłówek. Nagłówek jest nieszkodliwy dla żądań, które go nie czytają.
 */
export const erpClientIdInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ setHeaders: { [CLIENT_ID_HEADER]: getOrCreateClientId() } }));
