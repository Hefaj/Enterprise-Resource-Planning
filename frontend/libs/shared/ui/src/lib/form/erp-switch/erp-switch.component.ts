import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  input,
  signal,
  untracked,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormControl, ReactiveFormsModule } from '@angular/forms';
import { TuiSwitch } from '@taiga-ui/kit';
import { TuiIcon } from '@taiga-ui/core/components/icon';
import { TuiErrorComponent } from '@taiga-ui/core/components/error';
import { TuiHintDirective } from '@taiga-ui/core/portals/hint';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpSwitchConfig } from './erp-switch.types';
import { noop } from 'rxjs';

@Component({
  selector: 'erp-switch',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TuiSwitch,
    TuiIcon,
    TuiErrorComponent,
    TuiHintDirective,
    ErpTranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ErpSwitchComponent),
      multi: true,
    },
  ],
  template: `
    @let tooltipText = (_tooltip() | erpTranslate) || '';
    @let hintText = (_hint() | erpTranslate) || '';
    @let errorText = (_error() | erpTranslate) || '';
    @let labelText = (_label() | erpTranslate) || '';

    <div class="erp-switch-wrapper">
      <label class="erp-switch-label">
        <input
          tuiSwitch
          type="checkbox"
          [formControl]="activeControl()"
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

      @if (hintText) {
        <div class="erp-switch-hint">{{ hintText }}</div>
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

    .erp-switch-hint {
      font: var(--tui-typography-body-xs);
      color: var(--tui-text-secondary);
      margin-top: 0.125rem;
    }

    tui-error {
      font: var(--tui-typography-body-xs);
    }
  `],
})
export class ErpSwitchComponent implements ControlValueAccessor {
  readonly config = input.required<ErpSwitchConfig>();
  readonly control = input<FormControl | null>(null);

  readonly internalControl = new FormControl();
  readonly activeControl = computed(() => this.control() || this.internalControl);
  private readonly stateTrigger = signal(0);

  private _onChange: (value: boolean) => void = noop;
  protected onTouched: () => void = noop;

  constructor() {
    effect(() => {
      const configVal = unwrapSignal(this.config().value);
      if (configVal !== undefined) {
        untracked(() => {
          this.activeControl().setValue(configVal, { emitEvent: false });
          this.stateTrigger.update(v => v + 1);
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
        this.stateTrigger.update(v => v + 1);
      });
    });

    effect((onCleanup) => {
      const ctrl = this.activeControl();
      const sub1 = ctrl.valueChanges.subscribe(() => {
        this.stateTrigger.update(v => v + 1);
      });
      const sub2 = ctrl.statusChanges.subscribe(() => {
        this.stateTrigger.update(v => v + 1);
      });
      onCleanup(() => {
        sub1.unsubscribe();
        sub2.unsubscribe();
      });
    });

    this.internalControl.valueChanges.subscribe((val) => {
      this._onChange(val);
    });
  }

  protected onBlur(): void {
    this.onTouched();
    this.stateTrigger.update(v => v + 1);
  }

  protected readonly _label = computed(() => unwrapSignal(this.config().label));
  protected readonly _tooltip = computed(() => unwrapSignal(this.config().tooltip));
  protected readonly _hint = computed(() => unwrapSignal(this.config().hint));
  protected readonly _size = computed(() => unwrapSignal(this.config().size) ?? 'm');

  protected readonly _error = computed(() => {
    this.stateTrigger();
    const ctrl = this.activeControl();
    const isTouched = ctrl.touched || ctrl.dirty;
    const errors = ctrl.errors;
    if (isTouched && errors) {
      const firstErrorKey = Object.keys(errors)[0];
      const errorMessages = unwrapSignal(this.config().errorMessages) || {};
      return errorMessages[firstErrorKey] || `Błąd walidacji: ${firstErrorKey}`;
    }
    return undefined;
  });

  protected readonly _invalid = computed(() =>
    !!this._error()
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public writeValue(val: any): void {
    this.internalControl.setValue(val, { emitEvent: false });
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
    isDisabled ? this.internalControl.disable({ emitEvent: false }) : this.internalControl.enable({ emitEvent: false });
  }
}
