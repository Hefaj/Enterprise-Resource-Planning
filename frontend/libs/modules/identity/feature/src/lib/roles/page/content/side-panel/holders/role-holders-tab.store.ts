import { Injectable } from '@angular/core';
import { RoleScopeTabStore } from '../role-scope-tab.store';

/** Zakładka tylko do odczytu — bez podzaznaczenia wierszy. */
@Injectable() // Rejestrowany na poziomie RoleHoldersTabComponent
export class RoleHoldersTabStore extends RoleScopeTabStore<never> {
  public constructor() {
    super();
  }
}
