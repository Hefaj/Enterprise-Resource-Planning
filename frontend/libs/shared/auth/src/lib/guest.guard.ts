import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth-service';

export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  const authService = inject(AuthService);

  authService.loadTokenFromStorage();

  if (authService.$token()) {
    return router.navigate(['/']);
  }

  return true;
};
