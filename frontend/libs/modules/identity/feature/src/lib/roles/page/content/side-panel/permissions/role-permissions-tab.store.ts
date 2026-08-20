import { Injectable, computed } from '@angular/core';
import { RoleScopeTabStore } from '../role-scope-tab.store';

/** Wiersz tabeli uprawnień — kod uprawnienia + rola, do której należy. */
export interface RolePermissionRow {
  readonly roleUuid: string;
  readonly code: string;
  readonly isSystem: boolean;
}

@Injectable() // Rejestrowany na poziomie RolePermissionsTabComponent
export class RolePermissionsTabStore extends RoleScopeTabStore<RolePermissionRow> {
  /** Zaznaczone uprawnienia pogrupowane po roli — payload akcji „odbierz wskazane". */
  public readonly selectedPermissionsByRole = computed<Record<string, string[]>>(() => {
    const dict: Record<string, string[]> = {};
    for (const row of this.selectedChildren()) {
      (dict[row.roleUuid] ??= []).push(row.code);
    }
    return dict;
  });

  public constructor() {
    super();
  }
}
