import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { ErpFormConfig } from './erp-form.types';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpInputTextComponent } from '@erp/shared/ui/erp-input-text';
import { ErpSelectComponent } from '@erp/shared/ui/erp-select';
import { ErpDatePickerComponent } from '@erp/shared/ui/erp-datepicker';
import { ErpMultiSelectComponent } from '@erp/shared/ui/erp-multi-select';
import { ErpListboxComponent } from '@erp/shared/ui/erp-listbox';
import { ErpToggleSwitchComponent } from '@erp/shared/ui/erp-toggle-switch';
import { ErpAutoCompleteComponent } from '@erp/shared/ui/erp-auto-complete';

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
    ErpToggleSwitchComponent,
  ],
  template: `
    <form
      [formGroup]="config().formGroup"
      class="grid gap-6"
      [class]="'grid-cols-' + (gridCols() || 1)"
    >
      @for (field of fields(); track field.key) {
        <div [class]="field.resolvedColSpan ? 'col-span-' + field.resolvedColSpan : 'col-span-1'">
          @switch (field.type) {
            @case ('text') {
              <erp-input-text
                [config]="field.config"
                [control]="getControl(field.key)"
              />
            }
            @case ('select') {
              <erp-select
                [config]="field.config"
                [control]="getControl(field.key)"
              />
            }
            @case ('datepicker') {
              <erp-datepicker
                [config]="field.config"
                [control]="getControl(field.key)"
              />
            }
            @case ('multiselect') {
              <erp-multi-select
                [config]="field.config"
                [control]="getControl(field.key)"
              />
            }
            @case ('autocomplete') {
              <erp-auto-complete
                [config]="field.config"
                [control]="getControl(field.key)"
              />
            }
            @case ('listbox') {
              <erp-listbox
                [config]="field.config"
                [control]="getControl(field.key)"
              />
            }
            @case ('toggle') {
              <erp-toggle-switch
                [config]="field.config"
                [control]="getControl(field.key)"
              />
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

  protected fields = computed(() => {
    const rawFields = unwrapSignal(this.config().fields) || [];
    return rawFields.map((f) => ({
      ...f,
      resolvedColSpan: unwrapSignal(f.colSpan),
    }));
  });

  protected gridCols = computed(() => unwrapSignal(this.config().gridCols));

  public getControl(key: string): FormControl {
    return this.config().formGroup.get(key) as FormControl;
  }
}
