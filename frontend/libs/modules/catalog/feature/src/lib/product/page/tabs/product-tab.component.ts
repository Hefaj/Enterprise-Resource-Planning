import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'erp-product-tab',
  standalone: true,
  imports: [CommonModule],
  template: `<div style="padding: 1rem;">Product Tab Content</div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductTabComponent {}
