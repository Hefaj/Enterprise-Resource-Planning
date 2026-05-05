import { ChangeDetectionStrategy, Component, input, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenubarModule } from 'primeng/menubar';
import { MenuItem } from 'primeng/api';
import { ErpMenubarBuilder } from './erp-menubar.builder';

export { ErpMenubarBuilder };

export interface ErpMenubarConfig {
  items: MenuItem[];
}

@Component({
  selector: 'erp-menubar',
  standalone: true,
  imports: [CommonModule, MenubarModule],
  template: `
    <p-menubar [model]="config().items">
      @if (startTemplate()) {
        <ng-template #start>
          <ng-container *ngTemplateOutlet="startTemplate()!" />
        </ng-template>
      }
      @if (endTemplate()) {
        <ng-template #end>
          <ng-container *ngTemplateOutlet="endTemplate()!" />
        </ng-template>
      }
    </p-menubar>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpMenubarComponent {
  public config = input.required<ErpMenubarConfig>();
  public startTemplate = input<TemplateRef<any>>();
  public endTemplate = input<TemplateRef<any>>();
}
