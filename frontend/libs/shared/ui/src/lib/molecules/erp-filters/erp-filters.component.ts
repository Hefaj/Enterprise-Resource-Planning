import { ChangeDetectionStrategy, Component, input, output, OnInit, computed } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { ErpFiltersConfig, ErpFilterItem } from './erp-filters.types';
import { ErpInputTextComponent } from '../../atoms/erp-input-text/erp-input-text.component';
import { ErpSelectComponent } from '../../atoms/erp-select/erp-select.component';
import { ErpToggleSwitchComponent } from '../../atoms/erp-toggle-switch/erp-toggle-switch.component';
import { ErpDatePickerComponent } from '../../atoms/erp-datepicker/erp-datepicker.component';
import { ErpListFilterComponent } from '../../atoms/erp-list-filter/erp-list-filter.component';
import { ErpButtonComponent } from '../../atoms/erp-button/erp-button.component';
import { ErpButtonBuilder } from '../../atoms/erp-button/erp-button.builder';

import { ErpFiltersBuilder } from './erp-filters.builder';

export { ErpFiltersBuilder };

@Component({
  selector: 'erp-filters',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ErpInputTextComponent,
    ErpSelectComponent,
    ErpToggleSwitchComponent,
    ErpDatePickerComponent,
    ErpListFilterComponent,
    ErpButtonComponent,
  ],
  template: `
    <form [formGroup]="form" class="flex flex-col gap-6">
      @for (item of config().items; track item.id) {
        @switch (item.type) {
          @case ('text') {
            <erp-input-text [config]="item.config" [formControlName]="item.id" />
          }
          @case ('select') {
            <erp-select [config]="item.config" [formControlName]="item.id" />
          }
          @case ('switch') {
            <erp-toggle-switch [config]="item.config" [formControlName]="item.id" />
          }
          @case ('date') {
            <erp-datepicker [config]="item.config" [formControlName]="item.id" />
          }
          @case ('list') {
            <erp-list-filter [config]="item.config" [formControlName]="item.id" />
          }
        }
      }

      @if (config().showSubmitButton !== false) {
        <div class="mt-4 pt-6 border-t border-slate-100">
          <erp-button 
            [config]="submitBtnConfig()" 
            class="w-full" 
            (onClick)="onSubmit()"
          />
        </div>
      }
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpFiltersComponent implements OnInit {
  public config = input.required<ErpFiltersConfig>();
  public filterChange = output<any>();
  public filterSubmit = output<any>();

  protected form = new FormGroup({});
  protected submitBtnConfig = computed(() => 
    ErpButtonBuilder.create((b) => 
      b.setLabel(this.config().submitButtonLabel || 'Filtruj').setSeverity('info')
    )
  );

  public ngOnInit(): void {
    this.initializeForm();
  }

  private initializeForm(): void {
    const items = this.config().items;
    items.forEach((item) => {
      this.form.addControl(item.id, new FormControl(item.initialValue));
    });

    this.form.valueChanges.subscribe((value) => {
      this.filterChange.emit(value);
    });
  }

  protected onSubmit(): void {
    this.filterSubmit.emit(this.form.value);
  }

  public reset(): void {
    this.form.reset();
  }
}
