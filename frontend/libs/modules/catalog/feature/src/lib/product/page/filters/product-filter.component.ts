import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SignalFormControl } from '@angular/forms/signals/compat';
import {
  ErpDynamicFilterComponent,
  ErpDynamicFilterBuilder,
  ErpInputTextComponent,
  ErpInputTextBuilder,
  ErpDatePickerComponent,
  ErpDatePickerBuilder
} from '@erp/shared/ui';
import { ProductListViewStore } from '../product-list-view.store';
import { PRODUCT_KEYS } from '../../translation';

@Component({
  selector: 'erp-product-filter',
  standalone: true,
  imports: [ErpDynamicFilterComponent, ReactiveFormsModule],
  template: `<erp-dynamic-filter [config]="filtersConfig" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFilterComponent implements OnInit {
  private readonly _store = inject(ProductListViewStore);

  ngOnInit(): void {
        this._store.autoload.set(true);
  }

  protected readonly filtersForm = new FormGroup({
    sku: new SignalFormControl<string | null>(null),
    name: new SignalFormControl<string | null>(null),
    price: new SignalFormControl<number | null>(null),
    availableFrom: new SignalFormControl<Date | null>(null),
  });

  protected readonly filtersConfig = ErpDynamicFilterBuilder.create((b) => {
    b.addFilter(PRODUCT_KEYS.base.filters.sku.label, ErpInputTextComponent, {
      config: ErpInputTextBuilder.create((c) => c.setPlaceholder(PRODUCT_KEYS.base.filters.sku.placeholder).setFluid(true)),
      control: this.filtersForm.controls.sku,
    });
    b.addFilter(PRODUCT_KEYS.base.filters.name.label, ErpInputTextComponent, {
      config: ErpInputTextBuilder.create((c) => c.setPlaceholder(PRODUCT_KEYS.base.filters.name.placeholder).setFluid(true)),
      control: this.filtersForm.controls.name,
    });
    b.addFilter(PRODUCT_KEYS.base.filters.price.label, ErpInputTextComponent, {
      config: ErpInputTextBuilder.create((c) => c.setPlaceholder(PRODUCT_KEYS.base.filters.price.placeholder).setFluid(true)),
      control: this.filtersForm.controls.price,
    });
    b.addFilter(PRODUCT_KEYS.base.filters.availableFrom.label, ErpDatePickerComponent, {
      config: ErpDatePickerBuilder.create((c) => c.setPlaceholder(PRODUCT_KEYS.base.filters.availableFrom.placeholder)),
      control: this.filtersForm.controls.availableFrom,
    });
    b.setOnSubmit(() => this.onSubmitFilters());
  });

  protected onSubmitFilters(): void {
    const values = this.filtersForm.value;
    const rawPrice = values.price;
    const price = rawPrice ? Number(rawPrice) : undefined;

    this._store.updateFilters({
      sku: values.sku ?? undefined,
      name: values.name ?? undefined,
      price,
      availableFrom: values.availableFrom ?? undefined,
    });
  }
}
