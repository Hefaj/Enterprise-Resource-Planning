import { ChangeDetectionStrategy, Component, computed, forwardRef, input } from '@angular/core';
import { ControlValueAccessor, ReactiveFormsModule, NG_VALUE_ACCESSOR, FormControl } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { noop } from 'rxjs';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { AutoFocusModule } from 'primeng/autofocus';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpInputTextConfig } from './erp-input-text.types';
import { unwrapSignal, Translatable } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-input-text',
  standalone: true,
  imports: [InputTextModule, ReactiveFormsModule, FloatLabelModule, MessageModule, AutoFocusModule, ErpTranslatePipe],
  template: `
    @let _activeControl = activeControl();
    @let _errorMsg = getErrorMessage();
    
    @let _placeholder = placeholder();
    @let _hint = hint();
    @let _fluid = fluid();
    @let _variant = variant();
    @let _size = size();

    <div class="flex flex-col gap-2">
      <p-floatlabel variant="on">
        <input
          id="on_label"
          pInputText
          [formControl]="_activeControl"
          (blur)="onTouched()"
          aria-describedby="hint"
          [invalid]="!!_errorMsg"
          [pAutoFocus]="true"
          [fluid]="_fluid"
          [variant]="_variant || 'outlined'"
          [class.p-inputtext-sm]="_size === 'small'"
          [class.p-inputtext-lg]="_size === 'large'"
        />
        <label for="on_label">{{ (_placeholder | erpTranslate) || '' }}</label>
      </p-floatlabel>
      @if (_hint) {
        <small id="hint">{{ _hint | erpTranslate }}</small>
      }
      @if (_errorMsg) {
        <p-message
          severity="error"
          size="small"
          variant="simple"
        >
          {{ _errorMsg | erpTranslate }}
        </p-message>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ErpInputTextComponent),
      multi: true,
    },
  ],
})
export class ErpInputTextComponent implements ControlValueAccessor {
  public config = input.required<ErpInputTextConfig>();
  public control = input<FormControl | null>(null);
  public internalControl = new FormControl();

  public activeControl = computed(() => this.control() || this.internalControl);

  protected placeholder = computed(() => unwrapSignal(this.config().placeholder));
  protected hint = computed(() => unwrapSignal(this.config().hint));
  protected fluid = computed(() => unwrapSignal(this.config().fluid));
  protected variant = computed(() => unwrapSignal(this.config().variant));
  protected size = computed(() => unwrapSignal(this.config().size));
  protected errorMessages = computed(() => unwrapSignal(this.config().errorMessages));

  public onTouched: () => void = noop;
   
  private _onChange: (value: string) => void = noop;

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
