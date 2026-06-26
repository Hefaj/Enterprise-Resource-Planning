import { ChangeDetectionStrategy, Component, computed, forwardRef, input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule, FormControl } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { noop } from 'rxjs';
import { ErpDatePickerConfig } from './erp-datepicker.types';
import { unwrapSignal, Translatable } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-datepicker',
  standalone: true,
  imports: [DatePickerModule, ReactiveFormsModule, FloatLabelModule, MessageModule, ErpTranslatePipe],
  template: `
    @let _activeControl = activeControl();
    @let _errorMsg = getErrorMessage();
    
    @let _placeholder = placeholder();
    @let _hint = hint();
    @let _showIcon = showIcon();
    @let _dateFormat = dateFormat();
    @let _selectionMode = selectionMode();
    @let _view = view();
    @let _showTime = showTime();
    @let _hourFormat = hourFormat();

    <div class="flex flex-col gap-2">
      <p-floatlabel variant="on">
        <p-datepicker
          [formControl]="_activeControl"
          [showIcon]="_showIcon || false"
          [dateFormat]="_dateFormat || 'dd/mm/yy'"
          [selectionMode]="_selectionMode || 'single'"
          [view]="_view || 'date'"
          [showTime]="_showTime || false"
          [hourFormat]="_hourFormat || '24'"
          [fluid]="true"
          (onBlur)="onTouched()"
          [appendTo]="'body'"
        />
        <label>{{ (_placeholder | erpTranslate) || '' }}</label>
      </p-floatlabel>

      @if (_hint) {
        <small class="text-slate-500">{{ _hint | erpTranslate }}</small>
      }

      @if (_errorMsg) {
        <p-message severity="error" size="small" variant="simple">
          {{ _errorMsg | erpTranslate }}
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
  public config = input.required<ErpDatePickerConfig>();
  public control = input<FormControl | null>(null);
  public internalControl = new FormControl();

  public activeControl = computed(() => this.control() || this.internalControl);

  protected placeholder = computed(() => unwrapSignal(this.config().placeholder));
  protected hint = computed(() => unwrapSignal(this.config().hint));
  protected showIcon = computed(() => unwrapSignal(this.config().showIcon));
  protected dateFormat = computed(() => unwrapSignal(this.config().dateFormat));
  protected selectionMode = computed(() => unwrapSignal(this.config().selectionMode));
  protected view = computed(() => unwrapSignal(this.config().view));
  protected showTime = computed(() => unwrapSignal(this.config().showTime));
  protected hourFormat = computed(() => unwrapSignal(this.config().hourFormat));
  protected errorMessages = computed(() => unwrapSignal(this.config().errorMessages));

  public onTouched: () => void = noop;
   
  private _onChange: (value: any) => void = noop;

  public getErrorMessage(): Translatable | null {
    const ctrl = this.activeControl();
    if (ctrl.valid || (ctrl.pristine && !ctrl.touched)) return null;
    if (ctrl.errors) {
      const firstErrorKey = Object.keys(ctrl.errors)[0];
      return this.errorMessages()?.[firstErrorKey] || `Błąd: ${firstErrorKey}`;
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
