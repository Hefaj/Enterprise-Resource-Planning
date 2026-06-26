import { ChangeDetectionStrategy, Component, computed, forwardRef, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule, FormControl } from '@angular/forms';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { noop } from 'rxjs';
import { ErpAutoCompleteConfig } from './erp-auto-complete.types';
import { unwrapSignal, Translatable } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-auto-complete',
  standalone: true,
  imports: [CommonModule, AutoCompleteModule, ReactiveFormsModule, FloatLabelModule, MessageModule, ErpTranslatePipe],
  template: `
    @let _activeControl = activeControl();
    @let _errorMsg = getErrorMessage();
    
    @let _placeholder = placeholder();
    @let _hint = hint();
    @let _suggestions = suggestions();
    @let _optionLabel = optionLabel();
    @let _dropdown = dropdown();
    @let _multiple = multiple();
    @let _fluid = fluid();
    @let _forceSelection = forceSelection();

    <div class="flex flex-col gap-2">
      <p-floatlabel variant="on">
        <p-autocomplete
          [formControl]="_activeControl"
          [suggestions]="_suggestions || []"
          [optionLabel]="_optionLabel || 'label'"
          [dropdown]="_dropdown ?? true"
          [multiple]="_multiple || false"
          [fluid]="_fluid ?? true"
          [forceSelection]="_forceSelection || false"
          (completeMethod)="onComplete($event)"
          (onBlur)="onTouched()"
          [appendTo]="'body'"
        >
          <ng-template let-item #item>
            @let _itemComponent = unwrapComponent(config().itemComponent);
            @if (_itemComponent) {
              <ng-container *ngComponentOutlet="_itemComponent; inputs: { item: item }" />
            } @else {
              {{ item[_optionLabel || 'label'] }}
            }
          </ng-template>

          <ng-template #header>
             @let _headerComponent = unwrapComponent(config().headerComponent);
             @if (_headerComponent) {
               <ng-container *ngComponentOutlet="_headerComponent" />
             }
          </ng-template>

          <ng-template #footer>
             @let _footerComponent = unwrapComponent(config().footerComponent);
             @if (_footerComponent) {
               <ng-container *ngComponentOutlet="_footerComponent" />
             }
          </ng-template>
        </p-autocomplete>
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
      useExisting: forwardRef(() => ErpAutoCompleteComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpAutoCompleteComponent implements ControlValueAccessor {
  public config = input.required<ErpAutoCompleteConfig>();
  public control = input<FormControl | null>(null);
  public internalControl = new FormControl();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public complete = output<any>();

  public activeControl = computed(() => this.control() || this.internalControl);

  protected placeholder = computed(() => unwrapSignal(this.config().placeholder));
  protected hint = computed(() => unwrapSignal(this.config().hint));
  protected errorMessages = computed(() => unwrapSignal(this.config().errorMessages));
  protected suggestions = computed(() => unwrapSignal(this.config().suggestions));
  protected optionLabel = computed(() => unwrapSignal(this.config().optionLabel));
  protected dropdown = computed(() => unwrapSignal(this.config().dropdown));
  protected multiple = computed(() => unwrapSignal(this.config().multiple));
  protected fluid = computed(() => unwrapSignal(this.config().fluid));
  protected forceSelection = computed(() => unwrapSignal(this.config().forceSelection));

  public onTouched: () => void = noop;
   
  private _onChange: (value: any) => void = noop;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public onComplete(event: any): void {
    this.complete.emit(event);
  }

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

  protected unwrapComponent(componentSignal: any) {
    if (!componentSignal) return null;
    return unwrapSignal(componentSignal);
  }
}
