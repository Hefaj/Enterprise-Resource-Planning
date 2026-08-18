import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { map } from 'rxjs/operators';

/**
 * Blokuje trasy chronione, dopóki `checkAuth()` (patrz `app.config.ts`,
 * `withAppInitializerAuthCheck`) nie ustali stanu sesji OIDC. `isAuthenticated$` emituje
 * dopiero PO tym sprawdzeniu, więc guard nigdy nie widzi przejściowego stanu „jeszcze nie
 * wiadomo" jako `false` — nie ma efektu migania na `/login` przy odświeżeniu strony.
 */
export const erpAuthGuard: CanActivateFn = () => {
  const oidcSecurityService = inject(OidcSecurityService);
  const router = inject(Router);

  return oidcSecurityService.isAuthenticated$.pipe(
    map(({ isAuthenticated }) => isAuthenticated || router.parseUrl('/login')),
  );
};
