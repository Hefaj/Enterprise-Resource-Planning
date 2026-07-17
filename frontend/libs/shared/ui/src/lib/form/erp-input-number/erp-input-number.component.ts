import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  inject,
  Injectable,
  input,
  signal,
  untracked,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
  FormControl,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  TuiTextfieldComponent,
  TuiTextfieldOptionsDirective,
} from '@taiga-ui/core/components/textfield';
import { TuiLabel } from '@taiga-ui/core/components/label';
import { TuiIcon } from '@taiga-ui/core/components/icon';
import { TuiErrorComponent } from '@taiga-ui/core/components/error';
import { TuiHintDirective } from '@taiga-ui/core/portals/hint';
import { TuiInputNumber } from '@taiga-ui/kit';
import {
  TUI_NUMBER_FORMAT,
  TUI_DEFAULT_NUMBER_FORMAT,
} from '@taiga-ui/core/tokens';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpInputNumberConfig } from './erp-input-number.types';
import { noop } from 'rxjs';

/**
 * Pomocnicza usługa wstrzykiwana na poziomie komponentu, umożliwiająca
 * rezygnację z potencjalnych zależności cyklicznych w fabryce dostawcy TUI_NUMBER_FORMAT.
 */
@Injectable()
export class ErpInputNumberPrecisionHolder {
  readonly precision = signal<number>(0);
}

@Component({
  selector: 'erp-input-number',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TuiTextfieldComponent,
    TuiTextfieldOptionsDirective,
    TuiLabel,
    TuiIcon,
    TuiErrorComponent,
    TuiHintDirective,
    TuiInputNumber,
    ErpTranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    ErpInputNumberPrecisionHolder,
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ErpInputNumberComponent),
      multi: true,
    },
    {
      provide: TUI_NUMBER_FORMAT,
      useFactory: () => {
        const parent = inject(TUI_NUMBER_FORMAT, {
          optional: true,
          skipSelf: true,
        });
        const holder = inject(ErpInputNumberPrecisionHolder);
        return computed(() => {
          const parentFormat = parent
            ? parent()
            : TUI_DEFAULT_NUMBER_FORMAT;
          return {
            ...parentFormat,
            precision: holder.precision(),
            decimalSeparator: ',',
            thousandSeparator: ' ',
          };
        });
      },
    },
  ],
  template: `
    @let placeholderText = (_placeholder() | erpTranslate) || '';
    @let tooltipText = (_tooltip() | erpTranslate) || '';
    @let hintText = (_hint() | erpTranslate) || '';
    @let errorText = (_error() | erpTranslate) || '';
    @let labelText = (_label() | erpTranslate) || '';

    <div class="erp-input-number-wrapper">
      <tui-textfield
        [tuiTextfieldSize]="_size()"
        [tuiTextfieldCleaner]="activeControl().value !== null && activeControl().value !== undefined && activeControl().value !== ''"
      >
        @if (labelText) {
          <label tuiLabel>{{ labelText }}</label>
        }
        <input
          tuiInputNumber
          [placeholder]="placeholderText"
          [formControl]="activeControl()"
          [invalid]="_invalid()"
          [min]="_min()"
          [max]="_max()"
          [step]="_stepper() ? _step() : 0"
          (blur)="onBlur()"
        />

        @if (_iconStart()) {
          <tui-icon [icon]="_iconStart()!" />
        }

        @if (_tooltip() && tooltipText) {
          <tui-icon
            icon="@tui.circle-help"
            [tuiHint]="tooltipText"
          />
        }
      </tui-textfield>

      @if (errorText) {
        <tui-error
          [error]="errorText"
          [class.erp-shake]="shake()"
          (animationend)="onShakeEnd($event)"
        />
      }

      @if (hintText) {
        <div class="erp-input-number-hint">{{ hintText }}</div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      @keyframes erp-form-shake {
        0%,
        100% {
          transform: translateX(0);
        }
        15%,
        45%,
        75% {
          transform: translateX(-4px);
        }
        30%,
        60%,
        90% {
          transform: translateX(4px);
        }
      }

      .erp-shake {
        animation: erp-form-shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
      }

      .erp-input-number-wrapper {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .erp-input-number-hint {
        font: var(--tui-typography-body-xs);
        color: var(--tui-text-secondary);
        margin-top: 0.125rem;
      }

      tui-error {
        font: var(--tui-typography-body-xs);
      }
    `,
  ],
})
export class ErpInputNumberComponent implements ControlValueAccessor {
  readonly config = input.required<ErpInputNumberConfig>();
  readonly control = input<FormControl | null>(null);

  readonly internalControl = new FormControl<number | null>(null);
  readonly activeControl = computed(() => this.control() || this.internalControl);

  protected readonly shake = signal<boolean>(false);
  private readonly stateTrigger = signal(0);
  private lastValueChangeTime = 0;
  private lastShakeTime = 0;

  private readonly precisionHolder = inject(ErpInputNumberPrecisionHolder);

  private _onChange: (value: number | null) => void = noop;
  protected onTouched: () => void = noop;

  protected readonly _placeholder = computed(() => unwrapSignal(this.config().placeholder));
  protected readonly _label = computed(() => unwrapSignal(this.config().label));
  protected readonly _tooltip = computed(() => unwrapSignal(this.config().tooltip));
  protected readonly _hint = computed(() => unwrapSignal(this.config().hint));
  protected readonly _iconStart = computed(() => unwrapSignal(this.config().iconStart));
  protected readonly _size = computed(() => unwrapSignal(this.config().size) ?? 'm');
  protected readonly _mode = computed(() => unwrapSignal(this.config().mode) ?? 'integer');
  protected readonly _decimals = computed(() => unwrapSignal(this.config().decimals) ?? 2);
  protected readonly _sign = computed(() => unwrapSignal(this.config().sign) ?? 'any');
  protected readonly _stepper = computed(() => unwrapSignal(this.config().stepper) ?? false);

  protected readonly _precision = computed(() =>
    this._mode() === 'integer' ? 0 : this._decimals()
  );

  protected readonly _min = computed(() => {
    const configuredMin = unwrapSignal(this.config().min);
    const sign = this._sign();
    if (sign === 'positive') {
      return Math.max(0, configuredMin ?? 0);
    }
    return configuredMin ?? Number.MIN_SAFE_INTEGER;
  });

  protected readonly _max = computed(() => {
    const configuredMax = unwrapSignal(this.config().max);
    const sign = this._sign();
    if (sign === 'negative') {
      return Math.min(0, configuredMax ?? 0);
    }
    return configuredMax ?? Number.MAX_SAFE_INTEGER;
  });

  protected readonly _step = computed(() => {
    const configuredStep = unwrapSignal(this.config().step);
    if (configuredStep !== undefined) {
      return configuredStep;
    }
    return this._mode() === 'decimal' ? 0.01 : 1;
  });

  protected readonly _error = computed(() => {
    this.stateTrigger();
    const ctrl = this.activeControl();
    const isTouched = ctrl.touched || ctrl.dirty;
    const errors = ctrl.errors;
    if (isTouched && errors) {
      const firstErrorKey = Object.keys(errors)[0];
      const errorMessages = unwrapSignal(this.config().errorMessages) || {};
      return (
        errorMessages[firstErrorKey] || `Błąd walidacji: ${firstErrorKey}`
      );
    }
    return undefined;
  });

  protected readonly _invalid = computed(() => !!this._error());

  constructor() {
    effect(() => {
      this.precisionHolder.precision.set(this._precision());
    });

    effect(() => {
      const configVal = unwrapSignal(this.config().value);
      if (configVal !== undefined) {
        untracked(() => {
          this.activeControl().setValue(configVal, { emitEvent: false });
          this.stateTrigger.update((v) => v + 1);
        });
      }
    });

    effect(() => {
      const isDisabled = unwrapSignal(this.config().disabled);
      untracked(() => {
        if (isDisabled) {
          this.activeControl().disable({ emitEvent: false });
        } else {
          this.activeControl().enable({ emitEvent: false });
        }
        this.stateTrigger.update((v) => v + 1);
      });
    });

    effect((onCleanup) => {
      const ctrl = this.activeControl();
      const sub1 = ctrl.valueChanges.subscribe(() => {
        this.lastValueChangeTime = Date.now();
        this.stateTrigger.update((v) => v + 1);
      });
      const sub2 = ctrl.statusChanges.subscribe(() => {
        this.stateTrigger.update((v) => v + 1);
        const isTyping = Date.now() - this.lastValueChangeTime < 50;
        if (!isTyping && this._invalid()) {
          this.triggerShakeIfInvalid();
        }
      });

      const originalMarkAsTouched = ctrl.markAsTouched.bind(ctrl);
      const originalMarkAllAsTouched = ctrl.markAllAsTouched.bind(ctrl);

      ctrl.markAsTouched = (opts?: { onlySelf?: boolean }) => {
        originalMarkAsTouched(opts);
        this.stateTrigger.update((v) => v + 1);
        this.triggerShakeIfInvalid();
      };
      ctrl.markAllAsTouched = () => {
        originalMarkAllAsTouched();
        this.stateTrigger.update((v) => v + 1);
        this.triggerShakeIfInvalid();
      };

      onCleanup(() => {
        sub1.unsubscribe();
        sub2.unsubscribe();
        ctrl.markAsTouched = originalMarkAsTouched;
        ctrl.markAllAsTouched = originalMarkAllAsTouched;
      });
    });

    this.internalControl.valueChanges.subscribe((val) => {
      this._onChange(val);
    });
  }

  protected triggerShakeIfInvalid(): void {
    if (!this._invalid()) {
      return;
    }
    const now = Date.now();
    if (now - this.lastShakeTime < 100) {
      return;
    }
    this.lastShakeTime = now;

    if (this.shake()) {
      this.shake.set(false);
      setTimeout(() => this.shake.set(true), 10);
    } else {
      this.shake.set(true);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected onShakeEnd(event: any): void {
    if (event?.animationName === 'erp-form-shake') {
      this.shake.set(false);
    }
  }

  protected onBlur(): void {
    this.onTouched();
    this.stateTrigger.update((v) => v + 1);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public writeValue(val: any): void {
    const numVal =
      val === null || val === undefined || val === '' ? null : Number(val);
    this.internalControl.setValue(Number.isNaN(numVal) ? null : numVal, {
      emitEvent: false,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public registerOnChange(fn: any): void {
    this._onChange = fn;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    isDisabled
      ? this.internalControl.disable({ emitEvent: false })
      : this.internalControl.enable({ emitEvent: false });
  }
}
