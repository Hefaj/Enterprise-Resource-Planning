/**
 * Wiersz tabeli gwarancji — referencja do pojedynczego przypisania produkt-gwarancja.
 *
 * Celowo nie zawiera rozwiązanego `WarrantyVM` — pełna lista wierszy (i ich kolejność) jest
 * znana od razu z `ProductVM.warrantyAssignments`, natomiast katalogowe szczegóły gwarancji
 * (nazwa, standardowy okres, opis) doładowują się stopniowo w miarę scrollowania
 * (patrz `onVisibleRowsChange` w `warranty-tab.component.ts`). Komórki komponentów same
 * rozwiązują `WarrantyVM` po `warrantyUuid` przez `CatalogWarrantyOrchestrator.getOne()`.
 */
export interface WarrantyRow {
  productUuid: string;
  warrantyUuid: string;
  /** Okres gwarancji przypisany do TEGO produktu — część przypisania, zawsze znany od razu. */
  productDurationMonths: number;
}
