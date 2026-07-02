import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuiButton } from '@taiga-ui/core';
import { TuiButtonLoading } from '@taiga-ui/kit';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpButtonConfig } from './erp-button.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-button',
  standalone: true,
  imports: [CommonModule, TuiButton, TuiButtonLoading, ErpTranslatePipe],
  template: `
    @let _label = label();
    @let _appearance = appearance();
    @let _size = size();
    @let _iconStart = iconStart();
    @let _iconEnd = iconEnd();
    @let _loading = isLoading();
    @let _disabled = isDisabled();

    <button
      tuiButton
      type="button"
      [appearance]="_appearance || 'primary'"
      [size]="_size || 'm'"
      [iconStart]="_iconStart || ''"
      [iconEnd]="_iconEnd || ''"
      [loading]="_loading || false"
      [disabled]="_disabled || false"
      (click)="handleClick($event)"
    >
      @if (_label) {
        {{ (_label | erpTranslate) || '' }}
      }
      <ng-content></ng-content>
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpButtonComponent {
  public config = input.required<ErpButtonConfig>();

  protected internalLoading = signal(false);

  protected label = computed(() => unwrapSignal(this.config().label));
  protected appearance = computed(() => unwrapSignal(this.config().appearance));
  protected size = computed(() => unwrapSignal(this.config().size));
  protected iconStart = computed(() => unwrapSignal(this.config().iconStart));
  protected iconEnd = computed(() => unwrapSignal(this.config().iconEnd));
  protected loading = computed(() => unwrapSignal(this.config().loading));
  protected disabled = computed(() => unwrapSignal(this.config().disabled));

  protected isLoading = computed(() => this.loading() || this.internalLoading());
  protected isDisabled = computed(() => this.disabled() || this.isLoading());

  protected async handleClick(event: MouseEvent): Promise<void> {
    if (this.isDisabled()) {
      return;
    }
    const handler = this.config().onClick;
    if (!handler) {
      return;
    }

    const result = handler(event);
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
