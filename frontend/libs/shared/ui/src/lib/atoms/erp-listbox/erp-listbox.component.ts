import { ChangeDetectionStrategy, Component, computed, forwardRef, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule, FormControl } from '@angular/forms';
import { ListboxModule } from 'primeng/listbox';
import { MessageModule } from 'primeng/message';
import { noop } from 'rxjs';
import { ErpListboxConfig } from './erp-listbox.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-listbox',
  standalone: true,
  imports: [CommonModule, ListboxModule, ReactiveFormsModule, MessageModule],
  template: `
    @let _activeControl = activeControl();
    @let _errorMsg = getErrorMessage();
    
    @let _placeholder = placeholder();
    @let _hint = hint();
    @let _options = options();
    @let _optionLabel = optionLabel();
    @let _optionValue = optionValue();
    @let _multiple = multiple();
    @let _checkbox = checkbox();
    @let _filter = filter();
    @let _scrollHeight = scrollHeight();

    <div class="flex flex-col gap-2">
      @if (_placeholder) {
        <label class="text-sm font-medium text-surface-700 dark:text-surface-300">{{ _placeholder }}</label>
      }
      
      <p-listbox
        [formControl]="_activeControl"
        [options]="_options || []"
        [optionLabel]="_optionLabel || 'label'"
        [optionValue]="_optionValue || 'value'"
        [multiple]="_multiple || false"
        [checkbox]="_checkbox || false"
        [filter]="_filter || false"
        [scrollHeight]="_scrollHeight || '200px'"
        [style]="{ width: '100%' }"
        (onBlur)="onTouched()"
      >
        <ng-template let-item #item>
          @if (config().itemComponent) {
            <ng-container *ngComponentOutlet="config().itemComponent!; inputs: { item: item }" />
          } @else {
            {{ item[_optionLabel || 'label'] }}
          }
        </ng-template>
      </p-listbox>

      @if (_hint) {
        <small class="text-slate-500">{{ _hint }}</small>
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
  public config = input.required<ErpListboxConfig>();
  public control = input<FormControl | null>(null);
  public internalControl = new FormControl();

  public activeControl = computed(() => this.control() || this.internalControl);

  protected placeholder = computed(() => unwrapSignal(this.config().placeholder));
  protected hint = computed(() => unwrapSignal(this.config().hint));
  protected options = computed(() => unwrapSignal(this.config().options));
  protected optionLabel = computed(() => unwrapSignal(this.config().optionLabel));
  protected optionValue = computed(() => unwrapSignal(this.config().optionValue));
  protected multiple = computed(() => unwrapSignal(this.config().multiple));
  protected checkbox = computed(() => unwrapSignal(this.config().checkbox));
  protected filter = computed(() => unwrapSignal(this.config().filter));
  protected scrollHeight = computed(() => unwrapSignal(this.config().scrollHeight));
  protected errorMessages = computed(() => unwrapSignal(this.config().errorMessages));

  public onTouched: () => void = noop;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _onChange: (value: any) => void = noop;

  public getErrorMessage(): string | null {
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
