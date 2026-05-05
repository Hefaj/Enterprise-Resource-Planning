import { ChangeDetectionStrategy, Component, computed, forwardRef, input, Type } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule, FormControl } from '@angular/forms';
import { ListboxModule } from 'primeng/listbox';
import { MessageModule } from 'primeng/message';
import { ErpInputBase } from '../../base/erp-input-base';
import { noop } from 'rxjs';
import { ErpListboxBuilder } from './erp-listbox.builder';

export { ErpListboxBuilder };

export interface ErpListbox extends ErpInputBase {
  options: any[];
  optionLabel?: string;
  optionValue?: string;
  multiple?: boolean;
  checkbox?: boolean;
  filter?: boolean;
  scrollHeight?: string;
  itemComponent?: Type<any>;
}

@Component({
  selector: 'erp-listbox',
  standalone: true,
  imports: [CommonModule, ListboxModule, ReactiveFormsModule, MessageModule],
  template: `
    @let _config = config();
    @let _activeControl = activeControl();
    @let _errorMsg = getErrorMessage();

    <div class="flex flex-col gap-2">
      @if (_config.placeholder) {
        <label class="text-sm font-medium text-surface-700 dark:text-surface-300">{{ _config.placeholder }}</label>
      }
      
      <p-listbox
        [formControl]="_activeControl"
        [options]="_config.options"
        [optionLabel]="_config.optionLabel || 'label'"
        [optionValue]="_config.optionValue || 'value'"
        [multiple]="_config.multiple"
        [checkbox]="_config.checkbox"
        [filter]="_config.filter"
        [scrollHeight]="_config.scrollHeight || '200px'"
        [style]="{ width: '100%' }"
        (onBlur)="onTouched()"
      >
        <ng-template let-item #item>
          @if (_config.itemComponent) {
            <ng-container *ngComponentOutlet="_config.itemComponent; inputs: { item: item }" />
          } @else {
            {{ item[_config.optionLabel || 'label'] }}
          }
        </ng-template>
      </p-listbox>

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
      useExisting: forwardRef(() => ErpListboxComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpListboxComponent implements ControlValueAccessor {
  public config = input.required<ErpListbox>();
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
