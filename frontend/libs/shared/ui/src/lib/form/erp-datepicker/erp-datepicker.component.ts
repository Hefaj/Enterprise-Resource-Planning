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
import { TuiTextfieldComponent, TuiTextfieldOptionsDirective } from '@taiga-ui/core/components/textfield';
import { TuiLabel } from '@taiga-ui/core/components/label';
import { TuiErrorComponent } from '@taiga-ui/core/components/error';
import { TuiHintDirective } from '@taiga-ui/core/portals/hint';
import { TuiDropdown, TuiCalendar, TuiIcon } from '@taiga-ui/core';
import {
  TuiInputDate,
  TuiInputDateRange,
  TuiInputDateTime,
  TuiCalendarRange,
  TuiInputDateMulti,
  TuiInputChip,
} from '@taiga-ui/kit';
import { TuiItem } from '@taiga-ui/cdk';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpDatePickerConfig } from './erp-datepicker.types';
import { noop } from 'rxjs';

@Component({
  selector: 'erp-datepicker',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TuiTextfieldComponent,
    TuiTextfieldOptionsDirective,
    TuiLabel,
    TuiErrorComponent,
    TuiIcon,
    TuiHintDirective,
    TuiDropdown,
    TuiCalendar,
    TuiCalendarRange,
    TuiInputDate,
    TuiInputDateRange,
    TuiInputDateTime,
    TuiInputDateMulti,
    TuiInputChip,
    TuiItem,
    ErpTranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ErpDatePickerComponent),
      multi: true,
    },
  ],
  template: `
    @let placeholderText = (_placeholder() | erpTranslate) || '';
    @let errorText = (_error() | erpTranslate) || '';
    @let labelText = (_label() | erpTranslate) || '';
    @let tooltipText = (_tooltip() | erpTranslate) || '';
    @let hintText = (_hint() | erpTranslate) || '';

    <div class="erp-datepicker-wrapper">
      @if (labelText && _strategy() !== 'multiple') {
        <label tuiLabel>{{ labelText }}</label>
      }

      @if (_strategy() === 'single') {
        @if (_mode() === 'datetime') {
          <tui-textfield
            [tuiTextfieldSize]="_size()"
            [tuiTextfieldCleaner]="!!activeControl().value"
          >
            <input
              tuiInputDateTime
              [placeholder]="placeholderText"
              [formControl]="activeControl()"
              [invalid]="_invalid()"
              (blur)="onBlur()"
            />
            <tui-calendar *tuiDropdown />
            @if (_tooltip() && tooltipText) {
              <tui-icon
                icon="@tui.circle-help"
                [tuiHint]="tooltipText"
              />
            }
          </tui-textfield>
        } @else {
          <tui-textfield
            [tuiTextfieldSize]="_size()"
            [tuiTextfieldCleaner]="!!activeControl().value"
          >
            <input
              tuiInputDate
              [placeholder]="placeholderText"
              [formControl]="activeControl()"
              [invalid]="_invalid()"
              (blur)="onBlur()"
            />
            <tui-calendar *tuiDropdown />
            @if (_tooltip() && tooltipText) {
              <tui-icon
                icon="@tui.circle-help"
                [tuiHint]="tooltipText"
              />
            }
          </tui-textfield>
        }
      }

      @if (_strategy() === 'range') {
        <tui-textfield
          [tuiTextfieldSize]="_size()"
          [tuiTextfieldCleaner]="!!activeControl().value"
        >
          <input
            tuiInputDateRange
            [placeholder]="placeholderText"
            [formControl]="activeControl()"
            [invalid]="_invalid()"
            (blur)="onBlur()"
          />
          <tui-calendar-range *tuiDropdown />
          @if (_tooltip() && tooltipText) {
            <tui-icon
              icon="@tui.circle-help"
              [tuiHint]="tooltipText"
            />
          }
        </tui-textfield>
      }

      @if (_strategy() === 'multiple') {
        <tui-textfield
          multi
          [tuiTextfieldSize]="_size()"
          [tuiTextfieldCleaner]="!_disabled() && !!activeControl().value?.length"
        >
          @if (labelText) {
            <label tuiLabel>{{ labelText }}</label>
          }
          <input
            tuiInputDateMulti
            [placeholder]="placeholderText"
            [formControl]="activeControl()"
            [invalid]="_invalid()"
            (blur)="onBlur()"
          />
          <tui-calendar *tuiDropdown />
          <tui-input-chip *tuiItem />
          @if (_tooltip() && tooltipText) {
            <tui-icon
              icon="@tui.circle-help"
              [tuiHint]="tooltipText"
            />
          }
        </tui-textfield>
      }
      @if (errorText) {
        <tui-error [error]="errorText" [class.erp-shake]="shake()" (animationend)="onShakeEnd($event)"/>
      }

      @if (hintText) {
        <div class="erp-datepicker-hint">{{ hintText }}</div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    @keyframes erp-form-shake {
      0%, 100% {
        transform: translateX(0);
      }
      15%, 45%, 75% {
        transform: translateX(-4px);
      }
      30%, 60%, 90% {
        transform: translateX(4px);
      }
    }

    .erp-shake {
      animation: erp-form-shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
    }

    .erp-datepicker-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .erp-datepicker-hint {
      font: var(--tui-typography-body-xs);
      color: var(--tui-text-secondary);
      margin-top: 0.125rem;
    }

    tui-error {
      font: var(--tui-typography-body-xs);
    }
  `],
})
export class ErpDatePickerComponent implements ControlValueAccessor {
  readonly config = input.required<ErpDatePickerConfig>();
  readonly control = input<FormControl | null>(null);

  readonly internalControl = new FormControl();
  readonly activeControl = computed(() => this.control() || this.internalControl);

  protected readonly shake = signal<boolean>(false);
  private readonly stateTrigger = signal(0);
  private lastValueChangeTime = 0;
  private lastShakeTime = 0;

  private _onChange: (value: any) => void = noop;
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
      const sub1 = ctrl.valueChanges.subscribe((val) => {
        this.lastValueChangeTime = Date.now();
        this._onChange(val);
        this.stateTrigger.update(v => v + 1);
      });
      const sub2 = ctrl.statusChanges.subscribe(() => {
        this.stateTrigger.update(v => v + 1);
        const isTyping = (Date.now() - this.lastValueChangeTime) < 50;
        if (!isTyping && this._invalid()) {
          this.triggerShakeIfInvalid();
        }
      });

      const originalMarkAsTouched = ctrl.markAsTouched.bind(ctrl);
      const originalMarkAllAsTouched = ctrl.markAllAsTouched.bind(ctrl);

      ctrl.markAsTouched = (opts?: { onlySelf?: boolean }) => {
        originalMarkAsTouched(opts);
        this.stateTrigger.update(v => v + 1);
        this.triggerShakeIfInvalid();
      };
      ctrl.markAllAsTouched = () => {
        originalMarkAllAsTouched();
        this.stateTrigger.update(v => v + 1);
        this.triggerShakeIfInvalid();
      };

      onCleanup(() => {
        sub1.unsubscribe();
        sub2.unsubscribe();
        ctrl.markAsTouched = originalMarkAsTouched;
        ctrl.markAllAsTouched = originalMarkAllAsTouched;
      });
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
    this.stateTrigger.update(v => v + 1);
  }

  protected readonly _placeholder = computed(() => unwrapSignal(this.config().placeholder));
  protected readonly _label = computed(() => unwrapSignal(this.config().label));
  protected readonly _tooltip = computed(() => unwrapSignal(this.config().tooltip));
  protected readonly _hint = computed(() => unwrapSignal(this.config().hint));
  protected readonly _size = computed(() => unwrapSignal(this.config().size) ?? 'm');
  protected readonly _strategy = computed(() => unwrapSignal(this.config().strategy) ?? 'single');
  protected readonly _mode = computed(() => unwrapSignal(this.config().mode) ?? 'date');
  protected readonly _disabled = computed(() => !!unwrapSignal(this.config().disabled));

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

  public writeValue(val: any): void {
    this.internalControl.setValue(val, { emitEvent: false });
  }

  public registerOnChange(fn: any): void {
    this._onChange = fn;
  }

  public registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.internalControl.disable({ emitEvent: false });
    } else {
      this.internalControl.enable({ emitEvent: false });
    }
  }
}
