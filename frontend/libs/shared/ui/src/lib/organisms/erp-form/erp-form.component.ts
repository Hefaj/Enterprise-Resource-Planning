import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { ErpFormBuilder } from './erp-form.builder';
import { ErpInputTextComponent } from '../../atoms/erp-input-text/erp-input-text.component';
import { ErpSelectComponent } from '../../atoms/erp-select/erp-select.component';
import { ErpDatePickerComponent } from '../../atoms/erp-datepicker/erp-datepicker.component';
import { ErpMultiSelectComponent } from '../../atoms/erp-multi-select/erp-multi-select.component';
import { ErpListboxComponent } from '../../atoms/erp-listbox/erp-listbox.component';
import { ErpToggleSwitchComponent } from '../../atoms/erp-toggle-switch/erp-toggle-switch.component';
import { Type } from '@angular/core';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';
import { ErpAutoCompleteComponent } from '../../atoms/erp-auto-complete/erp-auto-complete.component';

export { ErpFormBuilder };

/**
 * Kontrakt dla dowolnego komponentu, który ma być użyty w ErpForm.
 */
export interface ErpFormAtom<TComp = any> {
  config: ErpComponentSignalInputs<TComp>;
  control: FormControl;
}

export type ErpFormFieldType = 'text' | 'select' | 'datepicker' | 'multiselect' | 'autocomplete' | 'listbox' | 'toggle' | 'custom';

export interface ErpFormField {
  key: string;
  type: ErpFormFieldType;
  config: any;
  colSpan?: number;
  component?: Type<any>; // Używane tylko dla typu 'custom'
}

export interface ErpFormConfig {
  fields: ErpFormField[];
  gridCols?: number;
  formGroup: FormGroup;
}

@Component({
  selector: 'erp-form',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    ErpInputTextComponent, 
    ErpSelectComponent, 
    ErpDatePickerComponent,
    ErpMultiSelectComponent,
    ErpAutoCompleteComponent,
    ErpListboxComponent,
    ErpToggleSwitchComponent
  ],
  template: `
    @let _config = config();
    <form [formGroup]="_config.formGroup" class="grid gap-6" [class]="'grid-cols-' + (_config.gridCols || 1)">
      @for (field of _config.fields; track field.key) {
        <div [class]="field.colSpan ? 'col-span-' + field.colSpan : 'col-span-1'">
          @switch (field.type) {
            @case ('text') {
              <erp-input-text [config]="field.config" [control]="getControl(field.key)" />
            }
            @case ('select') {
              <erp-select [config]="field.config" [control]="getControl(field.key)" />
            }
            @case ('datepicker') {
              <erp-datepicker [config]="field.config" [control]="getControl(field.key)" />
            }
            @case ('multiselect') {
              <erp-multi-select [config]="field.config" [control]="getControl(field.key)" />
            }
            @case ('autocomplete') {
              <erp-auto-complete [config]="field.config" [control]="getControl(field.key)" />
            }
            @case ('listbox') {
              <erp-listbox [config]="field.config" [control]="getControl(field.key)" />
            }
            @case ('toggle') {
              <erp-toggle-switch [config]="field.config" [control]="getControl(field.key)" />
            }
            @case ('custom') {
              <ng-container *ngComponentOutlet="field.component!; inputs: { config: field.config, control: getControl(field.key) }" />
            }
          }
        </div>
      }
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpFormComponent {
  public config = input.required<ErpFormConfig>();

  public getControl(key: string): FormControl {
    return this.config().formGroup.get(key) as FormControl;
  }
}
