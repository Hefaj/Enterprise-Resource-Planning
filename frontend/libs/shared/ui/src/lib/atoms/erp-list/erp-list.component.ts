import { ChangeDetectionStrategy, Component, computed, forwardRef, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule, FormControl, AbstractControl } from '@angular/forms';
import { ListboxModule } from 'primeng/listbox';
import { MessageModule } from 'primeng/message';
import { noop } from 'rxjs';
import { ErpListConfig } from './erp-list.types';
import { unwrapSignal } from '../../base/erp-signal-utils';

@Component({
  selector: 'erp-list',
  standalone: true,
  imports: [CommonModule, ListboxModule, ReactiveFormsModule, MessageModule],
  template: `
    @let _errorMsg = getErrorMessage();
    
    @let _placeholder = placeholder();
    @let _hint = hint();
    @let _items = items();
    @let _multiple = multiple();
    @let _checkbox = checkbox();
    @let _filter = filter();
    @let _filterPlaceholder = filterPlaceholder();
    @let _virtualScroll = virtualScroll();
    @let _virtualScrollItemSize = virtualScrollItemSize();
    @let _scrollHeight = scrollHeight();
    @let _readonly = readonly();

    <div class="flex flex-col gap-2 w-full">
      @if (_placeholder) {
        <label class="text-sm font-medium text-surface-700 dark:text-surface-300">{{ _placeholder }}</label>
      }
      
      <p-listbox
        [formControl]="activeControl()"
        [options]="_items || []"
        [multiple]="_multiple"
        [checkbox]="_checkbox"
        [filter]="_filter"
        [filterPlaceHolder]="_filterPlaceholder || ''"
        [virtualScroll]="_virtualScroll"
        [virtualScrollItemSize]="_virtualScrollItemSize || 35"
        [scrollHeight]="_scrollHeight || '250px'"
        [style]="{ width: '100%' }"
        [styleClass]="_readonly ? 'erp-list-readonly' : ''"
        (onBlur)="onTouched()"
      >
        <ng-template let-item #item>
          @let _itemComponent = unwrapComponent(config().itemComponent);
          @if (_itemComponent) {
            <ng-container *ngComponentOutlet="_itemComponent; inputs: { item: item }" />
          } @else {
            {{ resolveLabel(item) }}
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
  styles: [`
    :host ::ng-deep .erp-list-readonly .p-listbox-item {
      pointer-events: none !important;
      cursor: default !important;
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ErpListComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpListComponent implements ControlValueAccessor {
  public config = input.required<ErpListConfig>();
  public control = input<AbstractControl | null>(null);
  public internalControl = new FormControl();

  public activeControl = computed(() => (this.control() || this.internalControl) as any);

  protected placeholder = computed(() => unwrapSignal(this.config().placeholder));
  protected hint = computed(() => unwrapSignal(this.config().hint));
  protected items = computed(() => unwrapSignal(this.config().items));
  protected itemLabel = computed(() => unwrapSignal(this.config().itemLabel));
  protected itemValue = computed(() => unwrapSignal(this.config().itemValue));

  protected resolveLabel(item: any): string {
    const labelDef = this.itemLabel();
    if (typeof labelDef === 'function') {
      return labelDef(item);
    }
    return item[labelDef || 'label'];
  }

  protected resolveValue(item: any): any {
    const valDef = this.itemValue();
    if (typeof valDef === 'function') {
      return valDef(item);
    }
    if (typeof valDef === 'string') {
      return item[valDef];
    }
    return item;
  }
  
  protected multiple = computed(() => {
    const mode = unwrapSignal(this.config().selectionMode);
    if (mode === 'multiple') return true;
    if (mode === 'single' || mode === 'none') return false;
    return unwrapSignal(this.config().multiple) ?? false;
  });

  protected checkbox = computed(() => {
    const mode = unwrapSignal(this.config().selectionMode);
    if (mode === 'multiple') return true;
    if (mode === 'none') return false;
    return unwrapSignal(this.config().checkbox) ?? false;
  });

  protected filter = computed(() => unwrapSignal(this.config().filter) ?? false);
  protected filterPlaceholder = computed(() => unwrapSignal(this.config().filterPlaceholder));
  protected virtualScroll = computed(() => unwrapSignal(this.config().virtualScroll) ?? false);
  protected virtualScrollItemSize = computed(() => unwrapSignal(this.config().virtualScrollItemSize));
  protected scrollHeight = computed(() => unwrapSignal(this.config().scrollHeight));
  protected readonly = computed(() => {
    return unwrapSignal(this.config().readonly) ?? false;
  });
  protected errorMessages = computed(() => unwrapSignal(this.config().errorMessages));

  public onTouched: () => void = noop;
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
    const items = this.items() || [];
    if (this.multiple()) {
      const selectedItems = items.filter(item => {
        const itemVal = this.resolveValue(item);
        return Array.isArray(val) ? val.includes(itemVal) : itemVal === val;
      });
      this.internalControl.setValue(selectedItems, { emitEvent: false });
    } else {
      const selectedItem = items.find(item => this.resolveValue(item) === val);
      this.internalControl.setValue(selectedItem || null, { emitEvent: false });
    }
  }

  public registerOnChange(fn: any): void {
    this._onChange = fn;
    this.internalControl.valueChanges.subscribe(selected => {
      if (this.multiple()) {
        const values = (selected || []).map((item: any) => this.resolveValue(item));
        this._onChange(values);
      } else {
        const value = selected ? this.resolveValue(selected) : null;
        this._onChange(value);
        if (unwrapSignal(this.config().selectionMode) === 'none' && value !== null) {
          this.internalControl.setValue(null, { emitEvent: false });
        }
      }
    });
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
