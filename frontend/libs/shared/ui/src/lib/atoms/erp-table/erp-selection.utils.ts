import { ErpSelectionState } from './erp-table.types';

/**
 * Cele operacji masowej w kształcie, który rozumie `BatchEndpointBase.ResolveTargetsAsync`.
 *
 * Oba pola można wypełnić wprost ze stanu zaznaczenia (`selectedIds` + `filters`) —
 * one same się wykluczają i backend nie potrzebuje żadnej podpowiedzi, w którym trybie
 * jest komenda: przy zaznaczeniu pojedynczych wierszy `filters` jest puste, a przy
 * „Zaznacz wszystko" pusta jest lista identyfikatorów. Rozstrzyga kolejność z backendu:
 * niepuste `targetUuids` wygrywa, w przeciwnym razie cele wyznacza `targetFilter`.
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

