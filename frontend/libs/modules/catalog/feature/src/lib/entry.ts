import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
@Component({
  imports: [RouterModule],
  selector: 'erp-catalog-entry',
  template: `catalog works! wrapper <button (click)="nav('product')">Click me</button>
    <router-outlet></router-outlet> `,
})
export class RemoteEntry {
  private _router = inject(Router);
  public nav(path: string): void {
    this._router.navigate(['catalog', path]);
  }
}
