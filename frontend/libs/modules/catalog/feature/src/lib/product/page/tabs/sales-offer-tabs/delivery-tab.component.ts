import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'erp-delivery-tab',
  standalone: true,
  imports: [CommonModule],
  template: `<div style="padding: 1rem;">Delivery Tab Content</div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeliveryTabComponent {}
