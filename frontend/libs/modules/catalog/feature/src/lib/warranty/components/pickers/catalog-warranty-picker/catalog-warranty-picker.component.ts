import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FormControl } from '@angular/forms';

import {
  ErpInputPickerComponent,
  ErpInputPickerConfig,
  ErpInputPickerSearchQuery,
  ErpInputPickerSearchResult,
} from '@erp/shared/ui';

import { CatalogWarrantyOrchestrator, WarrantyVM } from '@erp/catalog/data-access';

import { WARRANTY_KEYS } from '../../../translation';

/** Rozmiar strony doładowywanej przy scrollowaniu listy w dropdownie. */
const PAGE_SIZE = 50;

/** Wysokość wiersza listy (px) — wirtualizacja jest obowiązkowa, gwarancji może być tysiące. */
const ROW_HEIGHT = 36;

/**
 * Konfiguracja wystawiana na zewnątrz — bez pól wiązanych wewnętrznie z orkiestratorem
 * (`items`/`searchFn`/`getFn`) oraz bez `valueKey`: picker keszuje pobrane pozycje pod wartością
 * zwracaną do modelu, więc musi nią zostać `uuid` — inaczej kolejne `getFn` dostawałoby
 * identyfikatory, których API gwarancji nie rozumie.
 */
export type CatalogWarrantyPickerConfig = Omit<
  ErpInputPickerConfig<WarrantyVM, string>,
  'items' | 'searchFn' | 'getFn' | 'valueKey'
>;

/**
 * Picker gwarancji katalogowych — smart component spinający `erp-input-picker` (tryb
 * asynchroniczny: `search` po nazwie zwraca uuidy, `get` dobiera pełne pozycje) z
 * `CatalogWarrantyOrchestrator`. Listowy odpowiednik `CatalogCategoryTreePickerComponent` —
 * gwarancje nie mają hierarchii, więc zamiast drzewa jest płaska, paginowana lista.
 *
 * Model formularza to `uuid` (single) albo `string[]` uuidów (multi) — wartości początkowe
 * z kontrolki picker rozwiązuje sam, wołając `getFn` dla nieznanych mu identyfikatorów.
 */
@Component({
  selector: 'erp-catalog-warranty-picker',
  standalone: true,
  imports: [ErpInputPickerComponent],
  template: `
    <erp-input-picker [config]="pickerConfig()" [control]="control()" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogWarrantyPickerComponent {
  private readonly warrantyOrchestrator = inject(CatalogWarrantyOrchestrator);

  public readonly config = input<CatalogWarrantyPickerConfig>({});
  public readonly control = input<FormControl<string | string[] | null> | null>(null);

  protected readonly pickerConfig = computed<ErpInputPickerConfig<WarrantyVM, string>>(() => {
    const cfg = this.config();
    return {
      ...cfg,
      valueKey: 'uuid',
      labelKey: cfg.labelKey ?? 'name',
      strategy: cfg.strategy ?? 'multi',
      label: cfg.label ?? WARRANTY_KEYS.picker.label,
      placeholder: cfg.placeholder ?? WARRANTY_KEYS.picker.placeholder,
      searchPlaceholder: cfg.searchPlaceholder ?? WARRANTY_KEYS.picker.searchPlaceholder,
      emptyContent: cfg.emptyContent ?? WARRANTY_KEYS.picker.empty,
      pageSize: cfg.pageSize ?? PAGE_SIZE,
      virtualScroll: cfg.virtualScroll ?? ROW_HEIGHT,
      searchFn: (query) => this.searchWarranties(query),
      getFn: (uuids) => this.loadWarranties(uuids),
    };
  });

  /**
   * `pageIndex` pickera liczy od zera, `page` w kontrakcie HTTP (`PagedRequest`) od jedynki —
   * bez tego przesunięcia backend klampuje 0 do 1 i pierwsza „doładowana" strona powtarza
   * zawartość pierwszej (patrz ten sam komentarz w `CatalogProductTableComponent`).
   *
   * `autoLoad: false`, bo pobraniem pozycji zajmuje się `getFn` — i tylko dla tych uuidów,
   * których picker nie ma jeszcze u siebie w keszu.
   */
  private async searchWarranties(query: ErpInputPickerSearchQuery): Promise<ErpInputPickerSearchResult> {
    const response = await this.warrantyOrchestrator.searchAsync(
      {
        name: query.search?.trim() || undefined,
        page: query.pageIndex + 1,
        pageSize: query.pageSize,
      },
      { autoLoad: false },
    );

    return { uuids: response.uuids ?? [], totalCount: response.totalCount };
  }

  /** Doładowuje wskazane gwarancje do cache orkiestratora i zwraca je w kolejności zapytania. */
  private async loadWarranties(uuids: string[]): Promise<WarrantyVM[]> {
    await this.warrantyOrchestrator.loadAsync(uuids);

    return uuids
      .map((uuid) => this.warrantyOrchestrator.resolveWarrantyVM(uuid))
      .filter((vm): vm is WarrantyVM => vm !== null);
  }
}
