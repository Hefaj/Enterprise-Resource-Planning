import { ChangeDetectionStrategy, Component, computed, forwardRef, input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MultiSelectModule } from 'primeng/multiselect';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { noop } from 'rxjs';
import { ErpMultiSelectConfig } from './erp-multi-select.types';
import { unwrapSignal, Translatable } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-multi-select',
  standalone: true,
  imports: [MultiSelectModule, ReactiveFormsModule, FloatLabelModule, MessageModule, ErpTranslatePipe],
  template: `
    @let _activeControl = activeControl();
    @let _errorMsg = getErrorMessage();
    
    @let _placeholder = placeholder();
    @let _hint = hint();
    @let _options = options();
    @let _optionLabel = optionLabel();
    @let _optionValue = optionValue();
    @let _filter = filter();
    @let _display = display();
    @let _showHeader = showHeader();
    @let _fluid = fluid();

    <div class="flex flex-col gap-2">
      <p-floatlabel variant="on">
        <p-multiselect
          [formControl]="_activeControl"
          [options]="_options || []"
          [optionLabel]="_optionLabel || 'label'"
          [optionValue]="_optionValue || 'value'"
          [filter]="_filter || false"
          [display]="_display || 'comma'"
          [showHeader]="_showHeader ?? true"
          [fluid]="_fluid ?? true"
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
      useExisting: forwardRef(() => ErpMultiSelectComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpMultiSelectComponent implements ControlValueAccessor {
  public config = input.required<ErpMultiSelectConfig>();
  public control = input<FormControl | null>(null);
  public internalControl = new FormControl();

  public activeControl = computed(() => this.control() || this.internalControl);

  protected placeholder = computed(() => unwrapSignal(this.config().placeholder));
  protected hint = computed(() => unwrapSignal(this.config().hint));
  protected options = computed(() => unwrapSignal(this.config().options));
  protected optionLabel = computed(() => unwrapSignal(this.config().optionLabel));
  protected optionValue = computed(() => unwrapSignal(this.config().optionValue));
  protected filter = computed(() => unwrapSignal(this.config().filter));
  protected display = computed(() => unwrapSignal(this.config().display));
  protected showHeader = computed(() => unwrapSignal(this.config().showHeader));
  protected fluid = computed(() => unwrapSignal(this.config().fluid));
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
