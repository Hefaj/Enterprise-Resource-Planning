import { ErpSelectionState } from './erp-table.types';

/**
 * Cele operacji masowej w kształcie, który rozumie `BatchEndpointBase.ResolveTargetsAsync`:
 * albo jawna lista identyfikatorów, albo filtr — nigdy oba naraz.
 *
 * `TFilter` to request wyszukiwania danego modułu (np. `SearchProductRequest`).
 */
export interface ErpBatchTargets<TFilter = Record<string, any>> {
  targetUuids?: string[];
  targetFilter?: TFilter;
}

/**
 * Metadane modalu operacji masowej. W trybie filtra komenda nie niesie identyfikatorów,
 * a modal i tak musi pokazać, ilu pozycji dotknie operacja — liczbę zna wywołujący
 * (licznik wyników tabeli), więc idzie metadanymi, a nie komendą: kontrakt HTTP
 * `BatchCommand` jest zamrożony dla klientów NSwag.
 */
export interface ErpBatchMetadata {
  targetCount?: number;
}

/**
 * Liczność zaznaczenia widziana przez toolbar — to ona przełącza go w tryb zaznaczenia.
 *
 * Przy „Zaznacz wszystko" tabela w trybie serwerowym nie zwraca żadnych `selectedItems`
 * (zaznaczenie opisuje filtr), więc liczbę bierzemy z licznika wszystkich pasujących
 * pozycji. Bez tego akcje masowe nigdy by się nie pokazały.
 */
export function erpSelectionCount<TData>(
  selection: ErpSelectionState<TData> | null | undefined,
): number {
  if (!selection) {
    return 0;
  }

  return selection.isAllSelected
    ? selection.totalCount ?? 0
    : selection.selectedItems?.length ?? 0;
}

/**
 * Tłumaczy zaznaczenie z tabeli na cele operacji masowej — dokładnie w tych dwóch
 * trybach, które rozumie backend:
 *
 * - zaznaczone pojedynczo wiersze → `targetUuids` (szablon + jawne identyfikatory),
 * - „Zaznacz wszystko" → `targetFilter` (szablon + filtr; zbiór celów wyznacza backend,
 *   bo przy dziesiątkach tysięcy pozycji klient nie ma ich nawet skąd wypisać).
 *
 * Identyfikatory bierzemy z `selectedIds`, czyli z tego, co ustawia `rowIdAccessor`
 * tabeli. Gdy tabela go nie ma (tryb kliencki po indeksie), przekaż `idAccessor`.
 *
 * `fallbackFilter` jest używany, gdy stan zaznaczenia nie niesie filtrów — np. gdy
 * tabela nie dostała ich przez `setFilters`.
 */
export function erpBatchTargets<TData, TFilter = Record<string, any>>(
  selection: ErpSelectionState<TData> | null | undefined,
  options?: {
    idAccessor?: (item: TData) => string;
    fallbackFilter?: TFilter;
  },
): ErpBatchTargets<TFilter> {
  if (selection?.isAllSelected) {
    // `filters` ze stanu zaznaczenia to migawka filtrów z momentu zaznaczania.
    return { targetFilter: (selection.filters as TFilter) ?? options?.fallbackFilter };
  }

  const idAccessor = options?.idAccessor;
  const targetUuids = idAccessor
    ? selection?.selectedItems?.map(idAccessor) ?? []
    : selection?.selectedIds ?? [];

  return { targetUuids };
}

/**
 * Czy komenda działa w trybie filtra — czyli frontend nie zna (i nie musi znać)
 * konkretnych celów, bo wyznaczy je backend.
 */
export function erpIsBatchFilterMode(targets: ErpBatchTargets<any> | null | undefined): boolean {
  return !targets?.targetUuids?.length && !!targets?.targetFilter;
}
