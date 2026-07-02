import { Component, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpPopoverComponent, ErpPopoverBuilder, ErpButtonComponent, ErpButtonBuilder, ErpBasePopoverDirective } from '@erp/shared/ui';
import { JobListComponent } from '../job-list/job-list.component';

@Component({
  selector: 'erp-job-popover',
  standalone: true,
  imports: [CommonModule, ErpPopoverComponent, ErpButtonComponent],
  template: `
    <erp-button [config]="buttonConfig" />
    <erp-popover #popover [config]="popoverConfig()" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobPopoverComponent extends ErpBasePopoverDirective {
  protected readonly buttonConfig = ErpButtonBuilder.create((b) =>
    b
     .setOnClick((event: MouseEvent) => this.toggle(event))
  );

  protected readonly popoverConfig = computed(() =>
    ErpPopoverBuilder.create((b) =>
      b.setComponent(JobListComponent, {
        selectionMode: this.selectionMode(),
        readonly: this.readonly(),
        onSelection: (val: any) => {
          const callback = this.onSelection();
          if (callback) {
            callback(val);
          }
        }
      })
    )
  );
}
