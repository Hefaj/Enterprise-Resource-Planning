import { ChangeDetectionStrategy, Component, computed, input, ViewChild, Type } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { PopoverModule, Popover } from 'primeng/popover';
import { ErpPopoverConfig } from './erp-popover.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-popover',
  standalone: true,
  imports: [PopoverModule, NgComponentOutlet],
  template: `
    <p-popover
      #popover
      [dismissable]="_dismissable()"
      [appendTo]="_appendTo()"
      [styleClass]="_styleClass()"
      [motionOptions]="_motionOptions()"
    >
      @if (_component()) {
        <ng-container *ngComponentOutlet="_component()!; inputs: _componentInputs()" />
      } @else {
        <ng-content></ng-content>
      }
    </p-popover>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpPopoverComponent {
  public config = input.required<ErpPopoverConfig>();

  @ViewChild('popover') public popover!: Popover;

  protected _component = computed(() => unwrapSignal(this.config().component));
  protected _componentInputs = computed(() => unwrapSignal(this.config().componentInputs) ?? {});

  protected _dismissable = computed(() => unwrapSignal(this.config().dismissable) ?? true);
  protected _appendTo = computed(() => unwrapSignal(this.config().appendTo) ?? 'body');
  protected _styleClass = computed(() => unwrapSignal(this.config().styleClass));
  protected _motionOptions = computed(() => unwrapSignal(this.config().motionOptions));

  public toggle(event: Event) {
    this.popover.toggle(event);
  }

  public show(event: Event) {
    this.popover.show(event);
  }

  public hide() {
    this.popover.hide();
  }
}
