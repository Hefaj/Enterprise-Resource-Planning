import { Injectable, signal } from '@angular/core';

/**
 * Stan strony `/identity/roles`. Bez filtrów (w odróżnieniu od `UsersStore`) — strona ładuje
 * WSZYSTKIE role na starcie (dziesiątki, nie tysiące, patrz `docs/backend/identity-authz.md`
 * §2), bo `RoleOrchestrator.getContainerRoles()` ("zawarta w") wymaga pełnego zbioru
 * załadowanego w cache, żeby dać poprawny wynik.
 */
@Injectable()
export class RolesStore {
  public readonly loading = signal<boolean>(false);
  public readonly selectedUuid = signal<string | null>(null);

  public setLoading(isLoading: boolean): void {
    this.loading.set(isLoading);
  }

  public selectRole(uuid: string | null): void {
    this.selectedUuid.set(uuid);
  }
}
