/**
 * Identyfikatory modali modułu Task Management.
 *
 * Każdy ID to hash MD5 gwarantujący unikalność i niezależność od konwencji nazewnictwa.
 * Definiowane w warstwie `util` (lekka, zero zależności od komponentów), żeby mogły być
 * importowane zarówno przez `feature` (definicje modali), jak i `contract` (lekki
 * `remoteModalIds` ładowany przy STARTUP) — patrz `docs/frontend/modals.md`.
 *
 * ─── Generowanie nowego ID ───
 *   node -e "console.log(require('crypto').createHash('md5').update('scope.entity.action').digest('hex'))"
 */

/** Modal: utworzenie zgłoszenia. Klucza czytelnego (`DEV-123`) nie ma w formularzu —
 * nadaje go serwer z licznika projektu (`docs/backend/task-management.md` §4). */
export const ISSUE_CREATE_MODAL_ID = 'a2a75be5cf5dfedd42585637cb253b65';

/** Modal: seryjna zmiana stanu zgłoszeń. */
export const ISSUE_SET_STATE_MODAL_ID = '7ecad2cd265bd4f45d1253da2ea4d7bf';

/** Modal: seryjne przypisanie zgłoszeń do osoby. Lista osób pochodzi ze wspólnego katalogu
 * użytkowników (`ERP_USER_DIRECTORY`), nie z modułu — patrz `cross-module-composition.md`. */
export const ISSUE_SET_ASSIGNEE_MODAL_ID = '45ee67c3d582d94b6502ffe26f49a1a8';

/** Modal: potwierdzenie publikacji workflow i mapowanie usuwanych stanów. */
export const WORKFLOW_SCHEME_PUBLISH_MODAL_ID = '098a7f9b29c1429b8b9c2df001a3997e';
