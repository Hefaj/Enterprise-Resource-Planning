import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { map } from 'rxjs/operators';

/**
 * Blokuje trasy chronione, dopóki `checkAuth()` (patrz `app.config.ts`,
 * `provideAppInitializer(() => inject(ErpAuthService).checkAuth())`) nie ustali stanu sesji
 * OIDC. Guardy są bezpieczne mimo że same subskrybują `isAuthenticated$` (a nie zamemoizowaną
 * obietnicę z `ErpAuthService.checkAuth()`, jak `STARTUP.ts`) — Angular Router z definicji
 * odkłada nawigację startową do czasu ukończenia WSZYSTKICH `APP_INITIALIZER`-ów, więc w
 * momencie, gdy guard w ogóle się uruchamia, `checkAuth()` już dawno się zakończył i
 * `isAuthenticated$` niesie prawdziwy stan, nie wartość startową `BehaviorSubject`u. Ten sam
 * wyścig, który to dotyczyło w `STARTUP.ts` (osobny initializer biegnący RÓWNOLEGLE z
 * `checkAuth()`), guardów nie dotyczy — nie ma tu efektu migania na `/login` przy odświeżeniu
 * strony.
 */
export const erpAuthGuard: CanActivateFn = () => {
  const oidcSecurityService = inject(OidcSecurityService);
  const router = inject(Router);

  return oidcSecurityService.isAuthenticated$.pipe(
    map(({ isAuthenticated }) => isAuthenticated || router.parseUrl('/login')),
  );
};
