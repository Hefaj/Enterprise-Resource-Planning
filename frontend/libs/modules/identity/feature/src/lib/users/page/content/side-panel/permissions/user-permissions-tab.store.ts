import { Injectable, computed } from '@angular/core';
import { UserPermissionGrantVM } from '@erp/identity/data-access';
import { UserScopeTabStore } from '../user-scope-tab.store';

/**
 * Wiersz tabeli uprawnień bezpośrednich — nadanie + użytkownik, do którego należy. Sam
 * `permissionCode` nie identyfikuje wiersza, bo to samo uprawnienie bywa nadane wielu
 * zaznaczonym użytkownikom.
 */
export interface UserPermissionGrantRow {
  readonly userUuid: string;
  readonly grant: UserPermissionGrantVM;
}

@Injectable() // Rejestrowany na poziomie UserPermissionsTabComponent, aby żył tylko tyle co zakładka
export class UserPermissionsTabStore extends UserScopeTabStore<UserPermissionGrantRow> {
  /** Zaznaczone nadania pogrupowane po użytkowniku — payload akcji „odbierz wskazane". */
  public readonly selectedPermissionsByUser = computed<Record<string, string[]>>(() => {
    const dict: Record<string, string[]> = {};
    for (const row of this.selectedChildren()) {
      (dict[row.userUuid] ??= []).push(row.grant.permissionCode);
    }
    return dict;
  });

  public constructor() {
    super();
  }
}
