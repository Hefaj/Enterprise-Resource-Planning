import { Injectable, signal } from '@angular/core';
import { SearchProductRequest, ProductVM } from '@erp/catalog/data-access';
import { ErpSelectionState } from '@erp/shared/ui';

@Injectable() // Rejestrowany na poziomie komponentu strony (Route/Page Component), aby żył tylko tyle co widok
export class ProductListViewStore {
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

  // 4. Zaznaczenia multimediów
  public readonly selectedMultimedia = signal<Set<string>>(new Set());
  private readonly lastToggledMultimedia = signal<string | null>(null);

  public toggleMultimediaSelection(uuid: string, selected: boolean, shiftKey: boolean = false, orderedGroupUuids: string[] = []): void {
    const lastUuid = this.lastToggledMultimedia();
    this.lastToggledMultimedia.set(uuid);

    if (shiftKey && lastUuid && orderedGroupUuids.length > 0) {
      const startIndex = orderedGroupUuids.indexOf(lastUuid);
      const endIndex = orderedGroupUuids.indexOf(uuid);

      // Jeśli oba kliknięte elementy należą do tej samej grupy, zaznaczamy zakres
      if (startIndex !== -1 && endIndex !== -1) {
        const min = Math.min(startIndex, endIndex);
        const max = Math.max(startIndex, endIndex);

        this.selectedMultimedia.update(set => {
          const newSet = new Set(set);
          for (let i = min; i <= max; i++) {
            if (selected) {
              newSet.add(orderedGroupUuids[i]);
            } else {
              newSet.delete(orderedGroupUuids[i]);
            }
          }
          return newSet;
        });
        return;
      }
    }

    // Standardowe zaznaczanie
    this.selectedMultimedia.update(set => {
      const newSet = new Set(set);
      if (selected) {
        newSet.add(uuid);
      } else {
        newSet.delete(uuid);
      }
      return newSet;
    });
  }
}
