import { ChangeDetectionStrategy, Component, computed, forwardRef, input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule, FormControl } from '@angular/forms';
import { ListboxModule } from 'primeng/listbox';
import { ErpInputBase } from '../../base/erp-input-base';
import { noop } from 'rxjs';

import { ErpListFilterBuilder } from './erp-list-filter.builder';

export { ErpListFilterBuilder };

export interface ErpListFilter extends ErpInputBase {
  options: { label: string; value: any }[];
  optionLabel?: string;
  optionValue?: string;
  multiple?: boolean;
  virtualScroll?: boolean;
  virtualScrollItemSize?: number;
  filter?: boolean;
}

@Component({
  selector: 'erp-list-filter',
  standalone: true,
  imports: [ListboxModule, ReactiveFormsModule],
  template: `
    @let _config = config();
    @let _activeControl = activeControl();

    <div class="flex flex-col gap-2">
      <span class="text-sm font-semibold text-slate-700">{{ _config.placeholder }}</span>
      <p-listbox
        [formControl]="_activeControl"
        [options]="_config.options"
        [multiple]="_config.multiple !== false"
        [checkbox]="true"
        [filter]="_config.filter !== false"
        [optionLabel]="_config.optionLabel || 'label'"
        [optionValue]="_config.optionValue || 'value'"
        [virtualScroll]="_config.virtualScroll !== false"
        [virtualScrollItemSize]="_config.virtualScrollItemSize || 34"
        [scrollHeight]="'200px'"
        [style]="{ width: '100%' }"
        [listStyle]="{ 'max-height': '200px' }"
      />
      @if (_config.hint) {
        <small class="text-slate-500">{{ _config.hint }}</small>
      }
    </div>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ErpListFilterComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpListFilterComponent implements ControlValueAccessor {
  public config = input.required<ErpListFilter>();
  public control = input<FormControl | null>(null);
  public internalControl = new FormControl();

  public activeControl = computed(() => this.control() || this.internalControl);

  public onTouched: () => void = noop;
  private _onChange: (value: any) => void = noop;

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
