import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ErpAuthService } from './erp-auth-service';

export const erpAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(ErpAuthService);
  const token = authService.$token();

  if (token) {
    const clonedRequest = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
    return next(clonedRequest);
  }

  return next(req);
};
