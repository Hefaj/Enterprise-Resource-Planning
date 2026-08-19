import { InjectionToken } from '@angular/core';

/**
 * Bazowy URL mikroserwisu Identity dla `PermissionStore` (`GET /me/permissions`).
 * Osobny token od `API_BASE_URL` w `@erp/identity/data-access` — `type:auth` nie może
 * zależeć od `type:data-access` (granice modułów, patrz CLAUDE.md), więc host podstawia
 * tę samą wartość dwoma różnymi tokenami (patrz `remote-api.providers.ts`).
 */
export const IDENTITY_PERMISSIONS_API_BASE_URL = new InjectionToken<string>('IDENTITY_PERMISSIONS_API_BASE_URL');
