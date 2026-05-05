import { ChangeDetectionStrategy, Component, computed, forwardRef, input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule, FormControl } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { ErpInputBase } from '../../base/erp-input-base';
import { noop } from 'rxjs';

import { ErpDatePickerBuilder } from './erp-datepicker.builder';

export { ErpDatePickerBuilder };

export interface ErpDatePicker extends ErpInputBase {
  showIcon?: boolean;
  dateFormat?: string;
  selectionMode?: 'single' | 'multiple' | 'range';
  view?: 'date' | 'month' | 'year';
  showTime?: boolean;
  hourFormat?: '12' | '24';
}

@Component({
  selector: 'erp-datepicker',
  standalone: true,
  imports: [DatePickerModule, ReactiveFormsModule, FloatLabelModule, MessageModule],
  template: `
    @let _config = config();
    @let _activeControl = activeControl();
    @let _errorMsg = getErrorMessage();

    <div class="flex flex-col gap-2">
      <p-floatlabel variant="on">
        <p-datepicker
          [formControl]="_activeControl"
          [showIcon]="_config.showIcon"
          [dateFormat]="_config.dateFormat || 'dd/mm/yy'"
          [selectionMode]="_config.selectionMode || 'single'"
          [view]="_config.view || 'date'"
          [showTime]="_config.showTime || false"
          [hourFormat]="_config.hourFormat || '24'"
          [fluid]="true"
          (onBlur)="onTouched()"
          [appendTo]="'body'"
        />
        <label>{{ _config.placeholder || '' }}</label>
      </p-floatlabel>

      @if (_config.hint) {
        <small class="text-slate-500">{{ _config.hint }}</small>
      }

      @if (_errorMsg) {
        <p-message severity="error" size="small" variant="simple">
          {{ _errorMsg }}
        </p-message>
      }
    </div>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ErpDatePickerComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpDatePickerComponent implements ControlValueAccessor {
  public config = input.required<ErpDatePicker>();
  public control = input<FormControl | null>(null);
  public internalControl = new FormControl();

  public activeControl = computed(() => this.control() || this.internalControl);

  public onTouched: () => void = noop;
  private _onChange: (value: any) => void = noop;

  public getErrorMessage(): string | null {
    const ctrl = this.activeControl();
    if (ctrl.valid || (ctrl.pristine && !ctrl.touched)) return null;
    if (ctrl.errors) {
      const firstErrorKey = Object.keys(ctrl.errors)[0];
      return this.config().errorMessages?.[firstErrorKey] || `Błąd: ${firstErrorKey}`;
    }
    return null;
  }

  public writeValue(val: any): void {
    this.internalControl.setValue(val, { emitEvent: false });
  }

  public registerOnChange(fn: any): void {
    this._onChange = fn;
    this.internalControl.valueChanges.subscribe(fn);
  }

  public registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    isDisabled ? this.internalControl.disable() : this.internalControl.enable();
  }
}
