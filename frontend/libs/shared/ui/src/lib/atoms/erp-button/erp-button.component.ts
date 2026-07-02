import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import { TuiButtonLoading } from '@taiga-ui/kit';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpButtonConfig } from './erp-button.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-button',
  standalone: true,
  imports: [TuiButton, TuiButtonLoading, ErpTranslatePipe],
  template: `
    @let _label = label();
    @let _icon = icon();
    @let _iconPos = iconPos();
    @let _severity = severity();
    @let _variant = variant();
    @let _size = size();
    @let _loading = isLoading();
    @let _disabled = isDisabled();

    @let _appearance = getAppearance(_severity, _variant);

    <button
      tuiButton
      [appearance]="_appearance"
      [iconStart]="_iconPos !== 'right' ? (_icon ?? '') : ''"
      [iconEnd]="_iconPos === 'right' ? (_icon ?? '') : ''"
      [size]="_size === 'small' ? 's' : (_size === 'large' ? 'l' : 'm')"
      [loading]="_loading"
      [disabled]="_disabled"
      (click)="handleClick($event)"
    >
      {{ (_label | erpTranslate) ?? '' }}
    </button>
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

  protected getAppearance(severity: string | undefined, variant: string | undefined): string {
    if (variant === 'text') {
      return 'flat';
    }
    if (variant === 'outlined') {
      return 'outline';
    }
    switch (severity) {
      case 'danger':
        return 'destructive';
      case 'secondary':
        return 'secondary';
      case 'success':
        return 'primary';
      default:
        return 'primary';
    }
  }

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


