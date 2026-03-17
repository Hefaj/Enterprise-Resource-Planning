import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { ErpAuthService } from './erp-auth-service';

export const erpAuthGuard: CanActivateFn = () => {
  const authService = inject(ErpAuthService);
  const router = inject(Router);

  if (authService.$token()) {
    return true;
  }

  return router.parseUrl('/login');
};
