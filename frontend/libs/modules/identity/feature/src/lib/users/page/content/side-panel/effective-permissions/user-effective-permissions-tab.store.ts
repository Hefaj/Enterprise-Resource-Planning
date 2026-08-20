import { Injectable } from '@angular/core';
import { UserScopeTabStore } from '../user-scope-tab.store';

/** Zakładka tylko do odczytu — nie ma podzaznaczenia wierszy, więc `TChild` pozostaje `never`. */
@Injectable() // Rejestrowany na poziomie UserEffectivePermissionsTabComponent
export class UserEffectivePermissionsTabStore extends UserScopeTabStore<never> {
  public constructor() {
    super();
  }
}
