import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  ErpDynamicFilterComponent,
  ErpDynamicFilterBuilder,
  ErpInputTextComponent,
  ErpInputTextBuilder,
  ErpDatePickerComponent,
  ErpDatePickerBuilder
} from '@erp/shared/ui';
import { ProductListViewStore } from '../product-list-view.store';

@Component({
  selector: 'erp-product-filter',
  standalone: true,
  imports: [ErpDynamicFilterComponent, ReactiveFormsModule],
  template: `<erp-dynamic-filter [config]="filtersConfig" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFilterComponent {
  private readonly _store = inject(ProductListViewStore);

  protected readonly filtersForm = new FormGroup({
    sku: new FormControl<string | null>(null),
    name: new FormControl<string | null>(null),
    price: new FormControl<number | null>(null),
    availableFrom: new FormControl<Date | null>(null),
  });

  protected readonly filtersConfig = ErpDynamicFilterBuilder.create((b) => {
    b.addFilter('Kod SKU', ErpInputTextComponent, {
      config: ErpInputTextBuilder.create((c) => c.setPlaceholder('Wpisz kod SKU').setFluid(true)),
      control: this.filtersForm.controls.sku,
    });
    b.addFilter('Nazwa produktu', ErpInputTextComponent, {
      config: ErpInputTextBuilder.create((c) => c.setPlaceholder('Wpisz nazwę produktu').setFluid(true)),
      control: this.filtersForm.controls.name,
    });
    b.addFilter('Cena netto do', ErpInputTextComponent, {
      config: ErpInputTextBuilder.create((c) => c.setPlaceholder('Maksymalna cena (PLN)').setFluid(true)),
      control: this.filtersForm.controls.price,
    });
    b.addFilter('Dostępny od', ErpDatePickerComponent, {
      config: ErpDatePickerBuilder.create((c) => c.setPlaceholder('Wybierz datę')),
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
