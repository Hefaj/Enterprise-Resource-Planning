import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  signal,
  effect,
  untracked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormControl, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TuiBlock } from '@taiga-ui/kit';
import { TuiCheckbox, TuiRadio, TuiTitle, TuiIcon, TuiGroup } from '@taiga-ui/core';
import { TuiHintDirective } from '@taiga-ui/core/portals/hint';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpToggleGroupConfig } from './erp-toggle-group.types';
import { noop } from 'rxjs';

@Component({
  selector: 'erp-toggle-group',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    TuiBlock,
    TuiCheckbox,
    TuiRadio,
    TuiTitle,
    TuiIcon,
    TuiGroup,
    TuiHintDirective,
    ErpTranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ErpToggleGroupComponent),
      multi: true,
    },
  ],
  template: `
    <div tuiGroup [size]="groupSize()" [collapsed]="true" [orientation]="isVertical() ? 'vertical' : 'horizontal'" class="erp-toggle-group" [class.erp-toggle-group--vertical]="isVertical()">
      @for (item of items(); track item.value) {
        @let itemText = (unwrap(item.text) | erpTranslate) || '';
        @let tooltipText = (unwrap(item.tooltip) | erpTranslate) || itemText;

        <label tuiBlock [tuiHint]="tooltipText" [class.tui-disabled]="unwrap(item.disabled)">
          @if (isMulti()) {
            <input
              tuiCheckbox
              type="checkbox"
              [value]="item.value"
              [ngModel]="isCheckboxChecked(item.value)"
              (ngModelChange)="onCheckboxChange(item.value, $event)"
              [disabled]="unwrap(item.disabled) || disabled()"
            />
          } @else {
            <input
              tuiRadio
              type="radio"
              [name]="groupName"
              [value]="item.value"
              [ngModel]="currentValue()"
              (ngModelChange)="onRadioChange($event)"
              [disabled]="unwrap(item.disabled) || disabled()"
            />
          }

          @if (unwrap(item.iconStart)) {
            <tui-icon [icon]="unwrap(item.iconStart)!" />
          }

          @if (itemText) {
            <div tuiTitle class="erp-toggle-group__title">
              {{ itemText }}
              @if (unwrap(item.subtext)) {
                <span tuiSubtitle>{{ unwrap(item.subtext) | erpTranslate }}</span>
              }
            </div>
          }

          @if (unwrap(item.iconEnd)) {
            <tui-icon [icon]="unwrap(item.iconEnd)!" />
          }
        </label>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    
    .erp-toggle-group {
      display: flex;
    }
    
    .erp-toggle-group--vertical {
      flex-direction: column;
      align-items: stretch;
    }
    
    .tui-disabled {
      opacity: 0.5;
      pointer-events: none;
    }
    
    .erp-toggle-group__title {
      white-space: nowrap;
    }
  `],
})
export class ErpToggleGroupComponent implements ControlValueAccessor {
  readonly config = input.required<ErpToggleGroupConfig>();
  readonly control = input<FormControl | null>(null);

  protected readonly items = computed(() => this.config().items);
  protected readonly isVertical = computed(() => unwrapSignal(this.config().direction) === 'vertical');
  protected readonly isMulti = computed(() => this.config().mode === 'multi');
  protected readonly groupSize = computed(() => unwrapSignal(this.config().size) || 'm');
  
  protected readonly disabled = signal(false);
  protected readonly currentValue = signal<any>(null);
  protected readonly groupName = `toggle-group-${Math.random().toString(36).substring(2, 9)}`;

  private _onChange: (value: any) => void = noop;
  protected onTouched: () => void = noop;

  constructor() {
    effect(() => {
      const isDisabled = unwrapSignal(this.config().disabled);
      untracked(() => {
        this.disabled.set(!!isDisabled);
      });
    });

    effect(() => {
      const ctrl = this.control();
      if (ctrl) {
        untracked(() => {
          this.currentValue.set(ctrl.value);
          ctrl.valueChanges.subscribe(val => {
            this.currentValue.set(val);
          });
          this.registerOnChange((val: any) => ctrl.setValue(val));
        });
      }
    });
  }

  public unwrap(val: any): any {
    return unwrapSignal(val);
  }

  public isCheckboxChecked(itemValue: any): boolean {
    const val = this.currentValue();
    return Array.isArray(val) && val.includes(itemValue);
  }

  public onCheckboxChange(itemValue: any, checked: boolean): void {
    const current = Array.isArray(this.currentValue()) ? [...this.currentValue()] : [];
    if (checked) {
      if (!current.includes(itemValue)) {
        current.push(itemValue);
      }
    } else {
      const idx = current.indexOf(itemValue);
      if (idx !== -1) {
        current.splice(idx, 1);
      }
    }
    this.currentValue.set(current);
    this._onChange(current);
    this.onTouched();
  }

  public onRadioChange(itemValue: any): void {
    this.currentValue.set(itemValue);
    this._onChange(itemValue);
    this.onTouched();
  }

  // ControlValueAccessor
  public writeValue(val: any): void {
    this.currentValue.set(val);
  }

  public registerOnChange(fn: any): void {
    this._onChange = fn;
  }

  public registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }
}
