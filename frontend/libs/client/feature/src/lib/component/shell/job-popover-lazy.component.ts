import { Component, OnInit, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'erp-job-popover-lazy',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- <ng-container *ngComponentOutlet="loadedComponent; inputs: { onSelection: onSelection() }" />
    @if (failed) {
      <erp-button [config]="fallbackButtonConfig" />
    } -->
  `
})
export class JobPopoverLazyComponent implements OnInit {
  public onSelection = input<(val: any) => void>();

  protected loadedComponent: any = null;
  protected failed = false;

  // protected readonly fallbackButtonConfig = ErpButtonBuilder.create((b) =>
  //   b
  //    .setDisabled(true)
  // );

  public async ngOnInit(): Promise<void> {
  //   try {
  //     // const module = await loadRemote<{ JobPopoverComponent: any }>('notification/JobPopover');
  //     // if (module) {
  //     //   this.loadedComponent = module.JobPopoverComponent;
  //     // } else {
  //     //   throw new Error('Module resolved to null');
  //     // }
  //   } catch (e) {
  //     console.warn('[JobPopoverLazyComponent] Failed to load notification remote, using fallback icon', e);
  //     this.failed = true;
  //   }
    await Promise.resolve();
  }
}
