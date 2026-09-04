import { inject } from '@angular/core';
import { SearchUserAccountRequest, UserOrchestrator, UserVM } from '@erp/identity/data-access';
import { ERP_SCOPE_PREVIEW_LIMIT, ErpScopeTabStore } from '@erp/shared/ui';
import { UsersStore } from '../../users.store';

/**
 * Ilu użytkowników dotyczy podgląd zakładki, gdy zaznaczenie jest filtrem (`query`).
 * To PRÓBKA — ma pokazać, czego dotyczy operacja, a nie udawać kompletnej listy.
 */
export const USER_SCOPE_PREVIEW_LIMIT = ERP_SCOPE_PREVIEW_LIMIT;

/**
 * Wspólna podstawa zakładek strony użytkowników zależnych od zaznaczenia (Role, Uprawnienia
 * bezpośrednie, Efektywne uprawnienia).
 *
 * Mechanika jest wspólna dla całej aplikacji i mieszka w `ErpScopeTabStore` (patrz
 * `docs/guides/frontend/pages.md` §6) — tutaj zostaje podłączenie zasięgu strony i orkiestratora
 * użytkowników oraz aliasy nazw z domeny.
 */
export abstract class UserScopeTabStore<TChild = unknown> extends ErpScopeTabStore<
  UserVM,
  SearchUserAccountRequest,
  TChild
> {
  /** UUID użytkowników, których zakładka faktycznie renderuje (komplet albo próbka). */
  public readonly visibleUserUuids = this.visibleParentUuids;

  /** Użytkownicy renderowani przez zakładkę — grupy wspólnej tabeli wierszy podrzędnych. */
  public readonly users = this.parents;

  /** Ilu użytkowników widać w panelu — liczba do zdania o zasięgu („Podgląd X z Y"). */
  public readonly shownUserCount = this.shownParentCount;

  protected constructor(previewLimit: number = USER_SCOPE_PREVIEW_LIMIT) {
    const page = inject(UsersStore);
    const orchestrator = inject(UserOrchestrator);

    super({
      scope: page.scope,
      parentById: (uuid) => orchestrator.getOne(uuid)(),
      resolveUuids: (filter, limit) => page.resolveUuids(filter, limit),
      previewLimit,
    });
  }
}
