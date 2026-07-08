import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'erp-product-filter',
  standalone: true,
  imports: [CommonModule],
  template: `<div style="padding: 1rem;">Product Filter Content</div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFilterComponent {}
