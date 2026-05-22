import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { ErpFormConfig } from './erp-form.types';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpInputTextComponent } from '../../atoms/erp-input-text';
import { ErpSelectComponent } from '../../atoms/erp-select';
import { ErpDatePickerComponent } from '../../atoms/erp-datepicker';
import { ErpMultiSelectComponent } from '../../atoms/erp-multi-select';
import { ErpListboxComponent } from '../../atoms/erp-listbox';
import { ErpToggleSwitchComponent } from '../../atoms/erp-toggle-switch';
import { ErpAutoCompleteComponent } from '../../atoms/erp-auto-complete';

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
              @let _customComponent = unwrapComponent(field.component);
              @if (_customComponent) {
                <ng-container *ngComponentOutlet="_customComponent; inputs: { config: field.config, control: getControl(field.key) }" />
              }
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

  protected unwrapComponent(componentSignal: any) {
    if (!componentSignal) return null;
    return unwrapSignal(componentSignal);
  }
}
