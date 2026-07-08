import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'erp-warranty-tab',
  standalone: true,
  imports: [CommonModule],
  template: `<div style="padding: 1rem;">Warranty Tab Content</div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WarrantyTabComponent {}
