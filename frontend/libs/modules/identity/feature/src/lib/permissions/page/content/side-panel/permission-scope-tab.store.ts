import { inject } from '@angular/core';
import { PermissionCatalogOrchestrator, PermissionCatalogVM } from '@erp/identity/data-access';
import { ErpScopeTabStore } from '@erp/shared/ui';
import { PermissionsStore } from '../../permissions.store';

/**
 * Wspólna podstawa zakładek panelu strony uprawnień. Mechanika mieszka w `ErpScopeTabStore`
 * (patrz `docs/guides/frontend/pages.md` §6) — tutaj zostaje podłączenie zasięgu strony i katalogu.
 * Jak w rolach: zbiór jest w całości w cache, więc zasięg nigdy nie jest `query`.
 */
export abstract class PermissionScopeTabStore<TChild = unknown> extends ErpScopeTabStore<
  PermissionCatalogVM,
  never,
  TChild
> {
  /** Kody uprawnień renderowane przez zakładkę. */
  public readonly visiblePermissionCodes = this.visibleParentUuids;

  /** Uprawnienia renderowane przez zakładkę — grupy wspólnej tabeli posiadaczy. */
  public readonly permissions = this.parents;

  public readonly shownPermissionCount = this.shownParentCount;

  protected constructor() {
    const page = inject(PermissionsStore);
    const orchestrator = inject(PermissionCatalogOrchestrator);

    super({
      scope: page.scope,
      parentById: (code) => orchestrator.getViewModel()().get(code),
    });
  }
}
