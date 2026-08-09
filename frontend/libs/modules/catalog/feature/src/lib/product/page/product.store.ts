import { Injectable, signal } from '@angular/core';
import { SearchProductRequest, ProductVM } from '@erp/catalog/data-access';
import { ErpSelectionState } from '@erp/shared/ui';

@Injectable() // Rejestrowany na poziomie komponentu strony (Route/Page Component), aby żył tylko tyle co widok
export class ProductStore {
  // 1. Stan globalnych filtrów strony
  public readonly filters = signal<Partial<SearchProductRequest>>({
    territoryCode: 'DE', // domyślne dla testu
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

  // 4. Zaznaczenia multimediów (płaska lista — jedna wspólna tabela grupowana per produkt)
  public readonly selectedMultimedia = signal<Set<string>>(new Set());

  // 5. Zaznaczenia gwarancji (jedna wspólna tabela grupowana per produkt)
  public readonly selectedWarrantiesByProduct = signal<Record<string, string[]>>({});

  public setAllWarrantySelections(dict: Record<string, string[]>): void {
    this.selectedWarrantiesByProduct.set(dict);
  }

  public clearWarrantySelection(): void {
    this.selectedWarrantiesByProduct.set({});
  }

  public getAllSelectedWarrantiesCount(): number {
    const dict = this.selectedWarrantiesByProduct();
    return Object.values(dict).reduce((acc, curr) => acc + curr.length, 0);
  }
}
