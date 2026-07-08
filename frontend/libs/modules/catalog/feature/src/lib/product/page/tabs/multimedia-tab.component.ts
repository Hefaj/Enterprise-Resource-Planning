import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'erp-multimedia-tab',
  standalone: true,
  imports: [CommonModule],
  template: `<div style="padding: 1rem;">Multimedia Tab Content</div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultimediaTabComponent {}
