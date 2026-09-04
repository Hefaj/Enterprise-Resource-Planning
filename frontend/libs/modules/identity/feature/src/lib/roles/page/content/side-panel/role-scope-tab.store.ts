import { inject } from '@angular/core';
import { RoleOrchestrator, RoleVM } from '@erp/identity/data-access';
import { ErpScopeTabStore } from '@erp/shared/ui';
import { RolesStore } from '../../roles.store';

/**
 * Wspólna podstawa zakładek strony ról zależnych od zaznaczenia (Uprawnienia, Role składowe,
 * Zawarta w, Kto ma tę rolę).
 *
 * Mechanika jest wspólna dla całej aplikacji i mieszka w `ErpScopeTabStore` (patrz
 * `docs/guides/frontend/pages.md` §6). Różnica wobec produktów i użytkowników: tabela ról działa
 * w trybie `client` (cały zbiór ról jest w cache), więc zasięg nigdy nie jest `query` —
 * nie ma czego materializować ani próbkować i `resolveUuids` nie jest potrzebne.
 */
export abstract class RoleScopeTabStore<TChild = unknown> extends ErpScopeTabStore<RoleVM, never, TChild> {
  /** UUID ról, które zakładka faktycznie renderuje. */
  public readonly visibleRoleUuids = this.visibleParentUuids;

  /** Role renderowane przez zakładkę — grupy wspólnej tabeli wierszy podrzędnych. */
  public readonly roles = this.parents;

  /** Ile ról widać w panelu. */
  public readonly shownRoleCount = this.shownParentCount;

  protected constructor() {
    const page = inject(RolesStore);
    const orchestrator = inject(RoleOrchestrator);

    super({
      scope: page.scope,
      parentById: (uuid) => orchestrator.getOne(uuid)(),
    });
  }
}
