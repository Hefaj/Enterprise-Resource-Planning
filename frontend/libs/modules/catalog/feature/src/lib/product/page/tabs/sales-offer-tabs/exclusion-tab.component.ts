import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'erp-exclusion-tab',
  standalone: true,
  imports: [CommonModule],
  template: `<div style="padding: 1rem;">Exclusion Tab Content</div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExclusionTabComponent {}
