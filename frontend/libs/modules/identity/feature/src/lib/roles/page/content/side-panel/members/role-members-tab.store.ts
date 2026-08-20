import { Injectable, computed } from '@angular/core';
import { RoleVM } from '@erp/identity/data-access';
import { RoleScopeTabStore } from '../role-scope-tab.store';

/** Wiersz tabeli ról składowych — rola składowa + rola-kontener, w której jest zawarta. */
export interface RoleMemberRow {
  readonly containerRoleUuid: string;
  readonly member: RoleVM;
  readonly isSystem: boolean;
}

@Injectable() // Rejestrowany na poziomie RoleMembersTabComponent
export class RoleMembersTabStore extends RoleScopeTabStore<RoleMemberRow> {
  /** Zaznaczone role składowe pogrupowane po roli-kontenerze. */
  public readonly selectedMembersByContainer = computed<Record<string, string[]>>(() => {
    const dict: Record<string, string[]> = {};
    for (const row of this.selectedChildren()) {
      (dict[row.containerRoleUuid] ??= []).push(row.member.uuid);
    }
    return dict;
  });

  public constructor() {
    super();
  }
}
