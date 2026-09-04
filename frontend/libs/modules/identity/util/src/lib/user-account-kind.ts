/**
 * Kopia wyliczenia `Identity.Domain.Users.UserAccountKind` — klient NSwag oddaje `kind` jako
 * `number` (dokument OpenAPI nie niesie nazw wariantów), więc front potrzebuje własnej, nazwanej
 * wersji. Ten sam wzorzec co `ISSUE_PRIORITY`/`SPRINT_STATUS` w
 * `@erp/task-management/util` (`issue-enums.ts`). Przy zmianie po stronie `Identity.Domain`
 * trzeba dopisać tutaj.
 *
 * Human — projekcja JIT przy logowaniu człowieka. Service — konto serwisowe (klucz
 * integracyjny, API-003) — patrz `docs/architecture/security.md` §2.
 */
export const USER_ACCOUNT_KIND = {
  Human: 0,
  Service: 1,
} as const;

export type UserAccountKindValue = (typeof USER_ACCOUNT_KIND)[keyof typeof USER_ACCOUNT_KIND];
