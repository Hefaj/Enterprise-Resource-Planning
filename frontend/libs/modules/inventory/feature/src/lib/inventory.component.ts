import { Component } from '@angular/core';

@Component({
  selector: 'erp-inventory-placeholder',
  standalone: true,
  template: `inventory`,
  styles: [`
    :host {
      display: block;
      padding: 1rem;
    }
  `],
})
export class InventoryComponent {}
