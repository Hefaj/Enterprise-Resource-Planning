import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionStore } from './permission.store';

/**
 * Blokuje trasę, jeśli bieżący użytkownik nie ma podanego kodu uprawnienia — przekierowuje
 * na `/forbidden`. Synchroniczny: `PermissionStore.load()` kończy się w `STARTUP.ts`
 * (`provideAppInitializer`), a Angular gwarantuje, że wszystkie initializery rozstrzygną
 * się przed pierwszą nawigacją, więc zbiór uprawnień jest tu już gotowy.
 *
 * @example
 * canActivate: [erpAuthGuard, erpPermissionGuard(ERP_PERMISSIONS.Catalog.ProductRead)]
 */
export function erpPermissionGuard(permissionCode: string): CanActivateFn {
  return () => {
    const permissionStore = inject(PermissionStore);
    const router = inject(Router);

    return permissionStore.has(permissionCode) || router.parseUrl('/forbidden');
  };
}
