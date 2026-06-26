import { ChangeDetectionStrategy, Component, computed, forwardRef, input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule, FormControl } from '@angular/forms';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { noop } from 'rxjs';
import { ErpToggleSwitchConfig } from './erp-toggle-switch.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-toggle-switch',
  standalone: true,
  imports: [ToggleSwitchModule, ReactiveFormsModule],
  template: `
    @let _activeControl = activeControl();
    @let _placeholder = placeholder();
    @let _hint = hint();

    <div class="flex items-center gap-3">
      <p-toggleswitch [formControl]="_activeControl" (onBlur)="onTouched()" />
      <div class="flex flex-col">
        <span class="text-sm font-medium text-slate-700">{{ _placeholder }}</span>
        @if (_hint) {
          <small class="text-slate-500">{{ _hint }}</small>
        }
      </div>
    </div>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ErpToggleSwitchComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpToggleSwitchComponent implements ControlValueAccessor {
  public config = input.required<ErpToggleSwitchConfig>();
  public control = input<FormControl | null>(null);
  public internalControl = new FormControl();

  public activeControl = computed(() => this.control() || this.internalControl);

  protected placeholder = computed(() => unwrapSignal(this.config().placeholder));
  protected hint = computed(() => unwrapSignal(this.config().hint));

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
