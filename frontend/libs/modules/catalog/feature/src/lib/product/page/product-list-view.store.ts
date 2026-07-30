import { Injectable, signal } from '@angular/core';
import { SearchProductRequest, ProductVM } from '@erp/catalog/data-access';
import { ErpSelectionState } from '@erp/shared/ui';

@Injectable() // Rejestrowany na poziomie komponentu strony (Route/Page Component), aby żył tylko tyle co widok
export class ProductListViewStore {
  // 1. Stan globalnych filtrów strony
  public readonly filters = signal<Partial<SearchProductRequest>>({
    modelId: 'asd', // domyślne dla testu
  });

  public setFilters(newFilters: Partial<SearchProductRequest>): void {
    this.filters.set(newFilters);
  }

  public updateFilters(partial: Partial<SearchProductRequest>): void {
    this.filters.update(f => ({ ...f, ...partial }));
  }

  // 2. Zaznaczenia w tabeli
  public readonly selection = signal<ErpSelectionState<ProductVM> | null>(null);

  public setSelection(state: ErpSelectionState<ProductVM>): void {
    this.selection.set(state);
  }

  // 3. Stan ładowania
  public readonly loading = signal<boolean>(false);

  public setLoading(isLoading: boolean): void {
    this.loading.set(isLoading);
  }
}
