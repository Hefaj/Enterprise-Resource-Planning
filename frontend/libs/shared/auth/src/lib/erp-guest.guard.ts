import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ErpAuthService } from './erp-auth-service';

export const erpGuestGuard: CanActivateFn = () => {
  const router = inject(Router);
  const authService = inject(ErpAuthService);

  authService.loadTokenFromStorage();

  if (authService.$token()) {
    return router.navigate(['/']);
  }

  return true;
};
