import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  imports: [RouterModule],
  selector: 'erp-notification-entry',
  template: `<router-outlet></router-outlet>`,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `],
})
export class RemoteEntry {
}
