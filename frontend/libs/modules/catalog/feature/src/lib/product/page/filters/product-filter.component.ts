import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  ErpDynamicFilterComponent,
  ErpDynamicFilterBuilder,
  ErpInputTextComponent,
  ErpInputTextBuilder,
  ErpDatePickerComponent,
  ErpDatePickerBuilder
} from '@erp/shared/ui';
import { CatalogProductOrchestrator, SearchProductRequest } from '@erp/catalog/data-access';

@Component({
  selector: 'erp-product-filter',
  standalone: true,
  imports: [ErpDynamicFilterComponent, ReactiveFormsModule],
  template: `<erp-dynamic-filter [config]="filtersConfig" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFilterComponent {
  private readonly _productOrchestrator = inject(CatalogProductOrchestrator);

  protected readonly skuControl = new FormControl<string | null>(null);
  protected readonly nameControl = new FormControl<string | null>(null);
  protected readonly priceControl = new FormControl<number | null>(null);
  protected readonly availableFromControl = new FormControl<Date | null>(null);

  protected readonly filtersConfig = ErpDynamicFilterBuilder.create((b) => {
    b.addFilter('Kod SKU', ErpInputTextComponent, {
      config: ErpInputTextBuilder.create((c) => c.setPlaceholder('Wpisz kod SKU')),
      control: this.skuControl,
    });
    b.addFilter('Nazwa produktu', ErpInputTextComponent, {
      config: ErpInputTextBuilder.create((c) => c.setPlaceholder('Wpisz nazwę produktu')),
      control: this.nameControl,
    });
    b.addFilter('Cena netto do', ErpInputTextComponent, {
      config: ErpInputTextBuilder.create((c) => c.setPlaceholder('Maksymalna cena (PLN)')),
      control: this.priceControl,
    });
    b.addFilter('Dostępny od', ErpDatePickerComponent, {
      config: ErpDatePickerBuilder.create((c) => c.setPlaceholder('Wybierz datę')),
      control: this.availableFromControl,
    });
    b.setOnSubmit(() => this.onSubmitFilters());
  });

  protected onSubmitFilters(): void {
    const rawPrice = this.priceControl.value;
    const price = rawPrice ? Number(rawPrice) : undefined;

    this._productOrchestrator.searchFilters.set({
      sku: this.skuControl.value || undefined,
      name: this.nameControl.value || undefined,
      price: isNaN(price as number) ? undefined : price,
      availableFrom: this.availableFromControl.value || undefined,
    });
  }
}
