/**
 * Identyfikatory modali modułu Task Management.
 *
 * Każdy ID to hash MD5 gwarantujący unikalność i niezależność od konwencji nazewnictwa.
 * Definiowane w warstwie `util` (lekka, zero zależności od komponentów), żeby mogły być
 * importowane zarówno przez `feature` (definicje modali), jak i `contract` (lekki
 * `remoteModalIds` ładowany przy STARTUP) — patrz `docs/guides/frontend/modals.md`.
 *
 * ─── Generowanie nowego ID ───
 *   node -e "console.log(require('crypto').createHash('md5').update('scope.entity.action').digest('hex'))"
 */

/** Modal: utworzenie zgłoszenia. Klucza czytelnego (`DEV-123`) nie ma w formularzu —
 * nadaje go serwer z licznika projektu (`docs/modules/task-management/domain.md` §4). */
export const ISSUE_CREATE_MODAL_ID = 'a2a75be5cf5dfedd42585637cb253b65';

/** Modal: seryjna zmiana stanu zgłoszeń. */
export const ISSUE_SET_STATE_MODAL_ID = '7ecad2cd265bd4f45d1253da2ea4d7bf';

/** Modal: seryjne przypisanie zgłoszeń do osoby. Lista osób pochodzi ze wspólnego katalogu
 * użytkowników (`ERP_USER_DIRECTORY`), nie z modułu — patrz `erp-user-picker`. */
export const ISSUE_SET_ASSIGNEE_MODAL_ID = '45ee67c3d582d94b6502ffe26f49a1a8';

/** Modal: uzupełnienie pól wymaganych przez przejście (`WorkflowTransitionDto.requiredFields`,
 * WF-004) — otwiera się PRZED wysłaniem `IssueSetStateCommand`, gdy zgłoszeniu brakuje choć
 * jednej wartości. Anulowanie nie zmienia niczego: karta na tablicy nie rusza się z miejsca
 * (`docs/modules/task-management/domain.md` §5.2, AC1). */
export const WORKFLOW_REQUIRED_FIELDS_MODAL_ID = '7009eb9ed7477ebaee96320cabb2bd1b';

/** Modal: utworzenie sprintu (nazwa, cel, zakres dat) — SPR-001. Uuid generuje klient, tak samo
 * jak przy utworzeniu zgłoszenia. */
export const SPRINT_CREATE_MODAL_ID = '1aebcdeea8dd3c328b96c65a29f437dd';

/** Modal: zamknięcie sprintu — jawna decyzja, dokąd trafiają niedokończone zgłoszenia
 * (backlog albo wskazany następny sprint), SPR-003 AC1. */
export const SPRINT_EXEC_CLOSE_MODAL_ID = 'b150748461f2ce0bad9beb25f5ae7c2a';

/** Modal: seryjne dopięcie tagu do zaznaczonych zgłoszeń (BULK-002). */
export const ISSUE_ADD_TAG_MODAL_ID = 'c3f1a1a0c7b6e6a4a6b0e6a9b7c4d2e1';

/** Modal: seryjne odpięcie tagu od zaznaczonych zgłoszeń (BULK-002). */
export const ISSUE_REMOVE_TAG_MODAL_ID = 'd4a2b2b1d8c7f7b5b7c1f7bac8d5e3f2';

/** Modal: seryjne przeniesienie zgłoszeń do innego projektu, razem z poddrzewem, z ekranem
 * decyzji o polach bez odpowiednika (ISS-010). */
export const ISSUE_SET_PROJECT_MODAL_ID = 'e5b3c3c2e9d8080c6c8d208bc9e6f4a3';

/** Modal: publikacja usunięcia stanów ze schematu (WF-006) — ekran mapowania stanu docelowego
 * dla każdego usuwanego stanu, który ma jeszcze otwarte zgłoszenia (`GetWorkflowSchemePublishPreview`).
 * Stan bez zgłoszeń usuwa się wprost, bez tego modalu. */
export const WORKFLOW_SCHEME_PUBLISH_MODAL_ID = 'c2d8cd1ed7bc6e93e91e7f35a8b0edaf';
