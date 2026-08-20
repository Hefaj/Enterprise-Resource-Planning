import { Injectable } from '@angular/core';
import { PermissionScopeTabStore } from '../permission-scope-tab.store';

/** Zakładka tylko do odczytu — bez podzaznaczenia wierszy. */
@Injectable() // Rejestrowany na poziomie PermissionHoldersPanelComponent
export class PermissionHoldersTabStore extends PermissionScopeTabStore<never> {
  public constructor() {
    super();
  }
}
