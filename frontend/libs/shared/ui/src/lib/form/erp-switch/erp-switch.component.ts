import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  untracked,
} from '@angular/core';
import { FormValueControl, FORM_FIELD } from '@angular/forms/signals';
import { FormsModule } from '@angular/forms';
import { TuiSwitch } from '@taiga-ui/kit';
import { TuiIcon } from '@taiga-ui/core/components/icon';
import { TuiErrorComponent } from '@taiga-ui/core/components/error';
import { TuiHintDirective } from '@taiga-ui/core/portals/hint';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpSwitchConfig } from './erp-switch.types';

@Component({
  selector: 'erp-switch',
  standalone: true,
  imports: [
    FormsModule,
    TuiSwitch,
    TuiIcon,
    TuiErrorComponent,
    TuiHintDirective,
    ErpTranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tooltipText = (_tooltip() | erpTranslate) || '';
    @let errorText = (_error() | erpTranslate) || '';
    @let labelText = (_label() | erpTranslate) || '';

    <div class="erp-switch-wrapper">
      <label class="erp-switch-label">
        <input
          tuiSwitch
          type="checkbox"
          [disabled]="_disabled()"
          [(ngModel)]="value"
          [size]="_size()"
          (blur)="onBlur()"
        />
        @if (labelText) {
          <span class="label-text">{{ labelText }}</span>
        }
        @if (_tooltip() && tooltipText) {
          <tui-icon
            icon="@tui.circle-help"
            [tuiHint]="tooltipText"
            class="tooltip-icon"
          />
        }
      </label>

      @if (errorText) {
        <tui-error [error]="errorText" />
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .erp-switch-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .erp-switch-label {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      user-select: none;
    }

    .erp-switch-label[disabled] {
      cursor: not-allowed;
      opacity: 0.56;
    }

    .label-text {
      font: var(--tui-typography-body-s);
      color: var(--tui-text-primary);
    }

    .tooltip-icon {
      color: var(--tui-text-secondary);
      cursor: help;
    }

    tui-error {
      font: var(--tui-typography-body-xs);
    }
  `],
})
export class ErpSwitchComponent implements FormValueControl<boolean> {
  readonly config = input.required<ErpSwitchConfig>();

  readonly value = model<boolean>(false);

  private readonly formField = inject(FORM_FIELD, { optional: true });

  constructor() {
    effect(() => {
      const configVal = unwrapSignal(this.config().value);
      if (configVal !== undefined) {
        untracked(() => {
          this.value.set(configVal);
        });
      }
    });
  }

  protected onBlur(): void {
    this.formField?.state().markAsTouched();
  }

  protected readonly _disabled = computed(() =>
    unwrapSignal(this.config().disabled) || (this.formField?.state().disabled() ?? false)
  );

  protected readonly _label = computed(() => unwrapSignal(this.config().label));
  protected readonly _tooltip = computed(() => unwrapSignal(this.config().tooltip));
  protected readonly _size = computed(() => unwrapSignal(this.config().size) ?? 'm');

  protected readonly _error = computed(() => {
    const isTouched = this.formField?.state().touched() ?? false;
    const fieldErrors = this.formField?.errors() ?? [];
    if (isTouched && fieldErrors.length > 0) {
      const firstError = fieldErrors[0];
      const errorMessages = unwrapSignal(this.config().errorMessages);
      if (errorMessages && errorMessages[firstError.kind]) {
        return errorMessages[firstError.kind];
      }
      return firstError.message || firstError.kind;
    }
    return undefined;
  });

  protected readonly _invalid = computed(() =>
    !!this._error() || (this.formField?.state().invalid() ?? false)
  );
}
