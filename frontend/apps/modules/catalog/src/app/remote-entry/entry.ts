import { Component, inject } from '@angular/core';

import { AuthService } from '@erp/auth';
@Component({
  imports: [],
  selector: 'app-catalog-entry',
  template: `catalog works!`,
})
export class RemoteEntry {
  private _authService = inject(AuthService);
}
