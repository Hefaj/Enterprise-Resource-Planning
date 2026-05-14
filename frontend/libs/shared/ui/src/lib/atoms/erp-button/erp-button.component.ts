import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ErpButtonConfig } from './erp-button.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-button',
  standalone: true,
  imports: [ButtonModule],
  template: `
    @let _label = label();
    @let _icon = icon();
    @let _iconPos = iconPos();
    @let _severity = severity();
    @let _rounded = rounded();
    @let _variant = variant();
    @let _size = size();
    @let _loading = isLoading();
    @let _disabled = isDisabled();
    @let _badge = badge();

    <p-button
      [label]="_label ?? ''"
      [icon]="_icon ?? ''"
      [iconPos]="_iconPos ?? 'left'"
      [severity]="_severity"
      [rounded]="_rounded ?? false"
      [variant]="_variant"
      [size]="_size"
      [loading]="_loading"
      [disabled]="_disabled"
      [badge]="_badge"
      (onClick)="handleClick($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpButtonComponent {
  public config = input.required<ErpButtonConfig>();
  protected internalLoading = signal(false);

  protected label = computed(() => unwrapSignal(this.config().label));
  protected icon = computed(() => unwrapSignal(this.config().icon));
  protected iconPos = computed(() => unwrapSignal(this.config().iconPos));
  protected severity = computed(() => unwrapSignal(this.config().severity));
  protected rounded = computed(() => unwrapSignal(this.config().rounded));
  protected variant = computed(() => unwrapSignal(this.config().variant));
  protected size = computed(() => unwrapSignal(this.config().size));
  protected loading = computed(() => unwrapSignal(this.config().loading));
  protected disabled = computed(() => unwrapSignal(this.config().disabled));
  protected badge = computed(() => unwrapSignal(this.config().badge));

  protected isLoading = computed(() => this.internalLoading() || !!this.loading());
  protected isDisabled = computed(() => !!this.disabled() || this.internalLoading());

  protected async handleClick(event: MouseEvent): Promise<void> {
    const callback = this.config().onClick;
    if (callback) {
      const result = callback(event);
      if (result instanceof Promise) {
        this.internalLoading.set(true);
        try {
          await result;
        } finally {
          this.internalLoading.set(false);
        }
      }
    }
  }


}
