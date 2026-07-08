import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TuiButton, TuiIcon } from '@taiga-ui/core';
import { TuiButtonLoading } from '@taiga-ui/kit';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpButtonConfig } from './erp-button.types';

@Component({
  selector: 'erp-button',
  standalone: true,
  imports: [
    TuiButton,
    TuiIcon,
    TuiButtonLoading,
    ErpTranslatePipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let labelText = (_label() | erpTranslate) || '';

    @if (!labelText) {
      <button
        tuiIconButton
        type="button"
        [appearance]="_appearance() === 'icon' ? 'flat' : _appearance()"
        [size]="_size()"
        [disabled]="_disabled() || _loadingCombined()"
        [loading]="_loadingCombined()"
        (click)="handleClick($event)"
      >
        @if (_iconStart()) {
          <tui-icon [icon]="_iconStart()!" />
        } @else if (_iconEnd()) {
          <tui-icon [icon]="_iconEnd()!" />
        }
      </button>
    } @else {
      <button
        tuiButton
        type="button"
        [appearance]="_appearance() === 'icon' ? 'primary' : _appearance()"
        [size]="_size()"
        [disabled]="_disabled() || _loadingCombined()"
        [loading]="_loadingCombined()"
        [iconStart]="_iconStart() ?? ''"
        [iconEnd]="_iconEnd() ?? ''"
        (click)="handleClick($event)"
      >
        <span>{{ labelText }}</span>
      </button>
    }
  `,
  styles: [`
    :host {
      display: inline-block;
    }
    button {
      width: 100%;
      height: 100%;
    }
  `]
})
export class ErpButtonComponent {
  readonly config = input.required<ErpButtonConfig>();

  protected readonly internalLoading = signal(false);

  protected readonly _label = computed(() => unwrapSignal(this.config().label));
  protected readonly _size = computed(() => unwrapSignal(this.config().size) ?? 'm');
  protected readonly _appearance = computed(() => unwrapSignal(this.config().appearance) ?? 'primary');
  protected readonly _disabled = computed(() => unwrapSignal(this.config().disabled) ?? false);
  protected readonly _loading = computed(() => unwrapSignal(this.config().loading) ?? false);
  protected readonly _iconStart = computed(() => unwrapSignal(this.config().iconStart));
  protected readonly _iconEnd = computed(() => unwrapSignal(this.config().iconEnd));

  protected readonly _loadingCombined = computed(() => this._loading() || this.internalLoading());

  protected async handleClick(event: MouseEvent): Promise<void> {
    const fn = this.config().fn;
    if (!fn) return;

    if (this._loadingCombined()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const result = fn();
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
