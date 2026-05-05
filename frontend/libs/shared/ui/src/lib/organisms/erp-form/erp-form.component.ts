import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { ErpFormBuilder } from './erp-form.builder';
import { ErpInputTextComponent } from '../../atoms/erp-input-text/erp-input-text.component';
import { ErpSelectComponent } from '../../atoms/erp-select/erp-select.component';
import { ErpDatePickerComponent } from '../../atoms/erp-datepicker/erp-datepicker.component';
import { ErpMultiSelectComponent } from '../../atoms/erp-multi-select/erp-multi-select.component';
import { ErpAutoCompleteComponent } from '../../atoms/erp-auto-complete/erp-auto-complete.component';
import { ErpListboxComponent } from '../../atoms/erp-listbox/erp-listbox.component';
import { ErpToggleSwitchComponent } from '../../atoms/erp-toggle-switch/erp-toggle-switch.component';

export { ErpFormBuilder };

export type ErpFormFieldType = 'text' | 'select' | 'datepicker' | 'multiselect' | 'autocomplete' | 'listbox' | 'toggle';

export interface ErpFormField {
  key: string;
  type: ErpFormFieldType;
  config: any;
  colSpan?: number; // Tailwind grid-cols-X
}

export interface ErpFormConfig {
  fields: ErpFormField[];
  gridCols?: number;
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
    <form [formGroup]="formGroup()" class="grid gap-6" [class]="'grid-cols-' + (config().gridCols || 1)">
      @for (field of config().fields; track field.key) {
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
          }
        </div>
      }
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpFormComponent {
  public config = input.required<ErpFormConfig>();
  public formGroup = input.required<FormGroup>();

  public getControl(key: string): FormControl {
    return this.formGroup().get(key) as FormControl;
  }
}
