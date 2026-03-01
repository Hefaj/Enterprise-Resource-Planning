import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from './auth-service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('Checking auth guard:', authService.$token());
  if (authService.$token()) {
    return true; // Użytkownik ma token, wpuszczamy do Remote
  }

  // Brak tokena - wyrzucamy do strony logowania w Host (Shell)
  return router.parseUrl('/login');
};
