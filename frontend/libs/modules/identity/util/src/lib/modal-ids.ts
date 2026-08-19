/**
 * Identyfikatory modali modułu Identity.
 *
 * Każdy ID to hash MD5 gwarantujący unikalność i niezależność od konwencji nazewnictwa.
 * Definiowane w warstwie `util` (lekka, zero zależności od komponentów), żeby mogły być
 * importowane zarówno przez `feature` (definicje modali) jak i `contract` (lekki
 * `remoteModalIds` ładowany przy STARTUP) — patrz `docs/frontend/modals.md`.
 *
 * ─── Generowanie nowego ID ───
 *   node -e "console.log(require('crypto').createHash('md5').update('scope.entity.action').digest('hex'))"
 */

/** Modal: Nadanie roli użytkownikowi */
export const ASSIGN_USER_ROLE_MODAL_ID = '04c82785e3f845a6d425d0e213aa3fdb';

/** Modal: Nadanie uprawnienia bezpośrednio użytkownikowi (z powodem) */
export const GRANT_USER_PERMISSION_MODAL_ID = '8e8c17a15bca7d2a2da1e8a828f5cae8';

/** Modal: Utworzenie nowej roli */
export const CREATE_ROLE_MODAL_ID = '0f03163eb7847d231905445b740e3314';

/** Modal: Dodanie uprawnienia do roli */
export const ADD_ROLE_PERMISSION_MODAL_ID = 'e9d1b09d124c99e3038f4905d7e4ad05';

/** Modal: Dodanie roli składowej do roli-kontenera */
export const ADD_ROLE_MEMBER_MODAL_ID = '1995b125f9a951f9ac2503211844677d';
