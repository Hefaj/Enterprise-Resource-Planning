import { InjectionToken } from '@angular/core';

/**
 * Wylogowanie wstrzykiwane jako funkcja, nie bezpośrednia zależność od `@erp/shared/auth` —
 * `feature`/`data-access` nie mogą importować warstwy `auth` (patrz granice modułów w
 * `CLAUDE.md`: `auth` jest dostępne tylko dla `contract`), więc host (`app.config.ts`)
 * podstawia tu `() => authService.logout()`. Ten sam wzorzec co `SIGNALR_ACCESS_TOKEN_FACTORY`.
 */
export const ERP_LOGOUT_HANDLER = new InjectionToken<() => void | Promise<void>>('ERP_LOGOUT_HANDLER', {
  providedIn: 'root',
  factory: (): (() => void) => () => {
    console.warn('[ErpLogoutHandler] Brak podstawionego handlera wylogowania w app.config.ts.');
  },
});
