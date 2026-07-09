import { Component } from '@angular/core';

@Component({
  selector: 'erp-sales-placeholder',
  standalone: true,
  template: `sales`,
  styles: [`
    :host {
      display: block;
      padding: 1rem;
    }
  `],
})
export class SalesComponent {}
