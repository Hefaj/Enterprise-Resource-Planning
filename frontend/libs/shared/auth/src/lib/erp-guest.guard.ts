import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { map } from 'rxjs/operators';

/** Przekierowuje z `/login` na start, jeśli sesja OIDC jest już aktywna. */
export const erpGuestGuard: CanActivateFn = () => {
  const oidcSecurityService = inject(OidcSecurityService);
  const router = inject(Router);

  return oidcSecurityService.isAuthenticated$.pipe(
    map(({ isAuthenticated }) => (isAuthenticated ? router.parseUrl('/') : true)),
  );
};
