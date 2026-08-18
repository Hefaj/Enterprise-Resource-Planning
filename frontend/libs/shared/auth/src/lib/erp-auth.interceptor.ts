import { HttpInterceptorFn } from '@angular/common/http';
import { authInterceptor } from 'angular-auth-oidc-client';

/**
 * Re-eksport `authInterceptor()` biblioteki `angular-auth-oidc-client` pod nazwą zgodną
 * z konwencją reszty repo (`erp*`) — dołącza `Authorization: Bearer <token>` wyłącznie do
 * żądań pasujących do `secureRoutes` w konfiguracji `provideAuth()` (patrz `app.config.ts`
 * hosta), więc nie trzeba było pisać własnej logiki dopasowania URL-i API modułów.
 */
export const erpAuthInterceptor: HttpInterceptorFn = authInterceptor();
