import { Directive, input, viewChild } from '@angular/core';
import { ErpPopoverComponent } from './erp-popover.component';

@Directive()
export abstract class ErpBasePopoverDirective {
  public readonly selectionMode = input<'single' | 'multiple' | 'none'>('none');
  public readonly readonly = input<boolean>(false);
  public readonly onSelection = input<(val: any) => void>();

  protected readonly popover = viewChild.required<ErpPopoverComponent>('popover');

  public toggle(event: Event): void {
    this.popover().toggle(event);
  }

  public show(event: Event): void {
    this.popover().show(event);
  }

  public hide(): void {
    this.popover().hide();
  }
}
