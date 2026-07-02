import { ChangeDetectionStrategy, Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, ReactiveFormsModule, NG_VALUE_ACCESSOR, FormControl } from '@angular/forms';
import { TuiTextfield, TuiIcon, TuiError, TuiDropdown } from '@taiga-ui/core';
import { TuiInputDate } from '@taiga-ui/kit';
import { TuiTooltip } from '@taiga-ui/kit';
import { TuiDay } from '@taiga-ui/cdk/date-time';
import { noop } from 'rxjs';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpDatePickerConfig } from './erp-datepicker.types';
import { unwrapSignal, Translatable } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-datepicker',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TuiTextfield,
    TuiInputDate,
    TuiIcon,
    TuiTooltip,
    TuiDropdown,
    TuiError,
    ErpTranslatePipe,
  ],
  template: `
    @let _activeControl = activeControl();
    @let _errorMsg = getErrorMessage();
    @let _placeholder = placeholder();
    @let _hint = hint();
    @let _size = size();
    @let _fluid = fluid();
    @let _min = minDay();
    @let _max = maxDay();

    <div class="flex flex-col gap-2" [class.w-full]="_fluid"> 
      <tui-textfield
        [class.w-full]="_fluid"
        [tuiTextfieldSize]="_size === 'small' ? 's' : (_size === 'large' ? 'l' : 'm')"
      >
        <label tuiLabel>{{ (_placeholder | erpTranslate) || '' }}</label>
        <input
          tuiInputDate
          [formControl]="_activeControl"
          [min]="_min"
          [max]="_max"
          (blur)="onTouched()"
        />
        <tui-calendar *tuiDropdown />
        
        @if (_hint) {
          <tui-icon [tuiTooltip]="_hint | erpTranslate" />
        }
      </tui-textfield>

      @if (_errorMsg) {
        <tui-error
          [error]="(_errorMsg | erpTranslate) ?? ''"
        />
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ErpDatePickerComponent),
      multi: true,
    },
  ],
})
export class ErpDatePickerComponent implements ControlValueAccessor {
  public config = input.required<ErpDatePickerConfig>();
  public control = input<FormControl | null>(null);
  public internalControl = new FormControl();

  public internalLoading = signal(false);

  public activeControl = computed(() => this.control() || this.internalControl);

  protected placeholder = computed(() => unwrapSignal(this.config().placeholder));
  protected hint = computed(() => unwrapSignal(this.config().hint));
  protected fluid = computed(() => unwrapSignal(this.config().fluid));
  protected size = computed(() => unwrapSignal(this.config().size));
  protected errorMessages = computed(() => unwrapSignal(this.config().errorMessages));

  protected minDay = computed(() => {
    const val = unwrapSignal(this.config().min);
    return val ?? null;
  });

  protected maxDay = computed(() => {
    const val = unwrapSignal(this.config().max);
    return val ?? null;
  });

  public onTouched: () => void = noop;
  private _onChange: (value: TuiDay | null) => void = noop;

  public getErrorMessage(): Translatable | null {
    const ctrl = this.activeControl();
    const errorMsgs = this.errorMessages() || {};

    if (ctrl.valid || (ctrl.pristine && !ctrl.touched)) {
      return null;
    }

    if (ctrl.errors) {
      const firstErrorKey = Object.keys(ctrl.errors)[0];
      return errorMsgs[firstErrorKey] || `Błąd walidacji: ${firstErrorKey}`;
    }

    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public writeValue(val: any): void {
    this.internalControl.setValue(val, { emitEvent: false });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public registerOnChange(fn: any): void {
    this._onChange = fn;
    this.internalControl.valueChanges.subscribe(fn);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    isDisabled ? this.internalControl.disable() : this.internalControl.enable();
  }
}
