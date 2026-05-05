import { ChangeDetectionStrategy, Component, computed, forwardRef, input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule, FormControl } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { ErpInputBase } from '../../base/erp-input-base';
import { noop } from 'rxjs';

import { ErpSelectBuilder } from './erp-select.builder';

export { ErpSelectBuilder };

export interface ErpSelect extends ErpInputBase {
  options: any[];
  optionLabel?: string;
  optionValue?: string;
  filter?: boolean;
  showClear?: boolean;
  fluid?: boolean;
}

@Component({
  selector: 'erp-select',
  standalone: true,
  imports: [SelectModule, ReactiveFormsModule, FloatLabelModule, MessageModule],
  template: `
    @let _config = config();
    @let _activeControl = activeControl();
    @let _errorMsg = getErrorMessage();

    <div class="flex flex-col gap-2">
      <p-floatlabel variant="on">
        <p-select
          [formControl]="_activeControl"
          [options]="_config.options"
          [optionLabel]="_config.optionLabel || 'label'"
          [optionValue]="_config.optionValue || 'value'"
          [filter]="_config.filter"
          [showClear]="_config.showClear"
          [fluid]="_config.fluid ?? true"
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
      useExisting: forwardRef(() => ErpSelectComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpSelectComponent implements ControlValueAccessor {
  public config = input.required<ErpSelect>();
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
