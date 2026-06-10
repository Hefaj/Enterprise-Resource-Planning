import { ChangeDetectionStrategy, Component, input, TemplateRef, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenubarModule } from 'primeng/menubar';
import { ErpMenubarConfig } from './erp-menubar.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-menubar',
  standalone: true,
  imports: [CommonModule, MenubarModule],
  template: `
    @let _items = items();

    <p-menubar [model]="_items || []">
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public startTemplate = input<TemplateRef<any>>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public endTemplate = input<TemplateRef<any>>();

  protected items = computed(() => unwrapSignal(this.config().items));
}
