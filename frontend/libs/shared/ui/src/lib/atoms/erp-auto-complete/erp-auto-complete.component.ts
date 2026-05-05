import { ChangeDetectionStrategy, Component, computed, forwardRef, input, output } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule, FormControl } from '@angular/forms';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { ErpInputBase } from '../../base/erp-input-base';
import { noop } from 'rxjs';
import { ErpAutoCompleteBuilder } from './erp-auto-complete.builder';

export { ErpAutoCompleteBuilder };

export interface ErpAutoComplete extends ErpInputBase {
  suggestions: any[];
  optionLabel?: string;
  dropdown?: boolean;
  multiple?: boolean;
  fluid?: boolean;
  forceSelection?: boolean;
}

@Component({
  selector: 'erp-auto-complete',
  standalone: true,
  imports: [AutoCompleteModule, ReactiveFormsModule, FloatLabelModule, MessageModule],
  template: `
    @let _config = config();
    @let _activeControl = activeControl();
    @let _errorMsg = getErrorMessage();

    <div class="flex flex-col gap-2">
      <p-floatlabel variant="on">
        <p-autocomplete
          [formControl]="_activeControl"
          [suggestions]="_config.suggestions"
          [optionLabel]="_config.optionLabel || 'label'"
          [dropdown]="_config.dropdown ?? true"
          [multiple]="_config.multiple"
          [fluid]="_config.fluid ?? true"
          [forceSelection]="_config.forceSelection"
          (completeMethod)="onComplete($event)"
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
      useExisting: forwardRef(() => ErpAutoCompleteComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpAutoCompleteComponent implements ControlValueAccessor {
  public config = input.required<ErpAutoComplete>();
  public control = input<FormControl | null>(null);
  public internalControl = new FormControl();

  public complete = output<any>();

  public activeControl = computed(() => this.control() || this.internalControl);

  public onTouched: () => void = noop;
  private _onChange: (value: any) => void = noop;

  public onComplete(event: any): void {
    this.complete.emit(event);
  }

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
