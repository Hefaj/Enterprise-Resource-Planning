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

// ─────────────────────────────────────────────────
// Zasięg zaznaczenia (selection scope)
// ─────────────────────────────────────────────────

/**
 * Rodzaj zasięgu zaznaczenia — to on, a nie samo `isAllSelected`, rozstrzyga o zachowaniu UI.
 *
 * - `none` — nic nie zaznaczono; toolbar pokazuje akcje sekcyjne.
 * - `explicit` — zaznaczenie jest **listą** znanych identyfikatorów: panele mogą pokazać
 *   komplet danych, a użytkownik wybierać pojedyncze pozycje wewnątrz nich.
 * - `query` — zaznaczenie jest **filtrem** o znanej liczności, ale nieznanej (i potencjalnie
 *   ogromnej) zawartości: panele pokazują wyłącznie próbkę, granularny wybór jest niemożliwy.
 */
export type ErpSelectionScopeKind = 'none' | 'explicit' | 'query';

/** Zaznaczenie jako lista identyfikatorów — cel operacji to `targetUuids`. */
export interface ErpExplicitSelectionScope<TItem> {
  kind: 'explicit';
  ids: string[];
  /**
   * Pozycje znane w chwili zaznaczania (wprost z tabeli). Przy zaznaczeniu zmaterializowanym
   * bywa puste — świeże modele widoku i tak trzeba wziąć z orkiestratora po `ids`.
   */
  items: TItem[];
  count: number;
  /** `true`, gdy zasięg powstał z „Zaznacz wszystko" rozwiązanego do listy identyfikatorów. */
  materialized: boolean;
  /** `true`, gdy materializacja jeszcze trwa — `ids` są wtedy niekompletne. */
  loading: boolean;
}

/** Zaznaczenie jako filtr — cel operacji to `targetFilter`, rozwiązywany po stronie backendu. */
export interface ErpQuerySelectionScope<TFilter> {
  kind: 'query';
  filter: TFilter;
  /** Liczność w chwili zaznaczania — szacunek, bo backend rozwiąże filtr dopiero przy tworzeniu zadania. */
  count: number;
}

export type ErpSelectionScope<TItem = unknown, TFilter = Record<string, any>> =
  | { kind: 'none' }
  | ErpExplicitSelectionScope<TItem>
  | ErpQuerySelectionScope<TFilter>;

/** Wspólna, stała instancja pustego zasięgu — pozwala uniknąć tworzenia obiektu w każdym `computed`. */
export const ERP_SELECTION_SCOPE_NONE: ErpSelectionScope<any, any> = { kind: 'none' };

/** Parametry rozstrzygania zasięgu — patrz `erpResolveSelectionScope`. */
export interface ErpSelectionScopeOptions {
  /**
   * Do ilu pozycji „Zaznacz wszystko" jest jeszcze materializowane do listy identyfikatorów.
   * Poniżej progu użytkownik dostaje normalny, pełny widok; powyżej — tryb `query`.
   */
  materializeLimit: number;
  /** Wynik materializacji dla BIEŻĄCYCH filtrów (`null` = jeszcze nie znany). */
  materializedIds?: string[] | null;
}

/**
 * Sprowadza surowy stan tabeli do zasięgu, którym da się sterować UI i celami operacji masowych.
 *
 * Kluczowa decyzja: o trybie rozstrzyga **liczność**, nie flaga `isAllSelected`. Zaznaczenie
 * „wszystkiego" przy wąskim filtrze (kilka pozycji) jest materializowane do listy identyfikatorów
 * i od tego momentu nieodróżnialne od ręcznego zaznaczenia — dzięki temu tryb ograniczony
 * (`query`) włącza się dopiero tam, gdzie naprawdę musi.
 *
 * Materializacja daje też uczciwe WYSIWYG: skoro użytkownik widzi konkretne pozycje, operacja
 * obejmie dokładnie je (`targetUuids`), a nie zbiór, który filtr zwróci sekundę później.
 */
export function erpResolveSelectionScope<TItem, TFilter>(
  selection: ErpSelectionState<TItem> | null | undefined,
  options: ErpSelectionScopeOptions,
): ErpSelectionScope<TItem, TFilter> {
  const count = erpSelectionCount(selection);
  if (!selection || count === 0) {
    return ERP_SELECTION_SCOPE_NONE;
  }

  if (!selection.isAllSelected) {
    return {
      kind: 'explicit',
      ids: selection.selectedIds ?? [],
      items: selection.selectedItems ?? [],
      count,
      materialized: false,
      loading: false,
    };
  }

  if (count > options.materializeLimit) {
    return {
      kind: 'query',
      filter: (selection.filters ?? {}) as TFilter,
      count,
    };
  }

  const ids = options.materializedIds;
  return {
    kind: 'explicit',
    ids: ids ?? [],
    items: [],
    count,
    materialized: true,
    loading: ids == null,
  };
}

/** Liczność zasięgu — dla `query` to szacunek z licznika wyników. */
export function erpSelectionScopeCount(scope: ErpSelectionScope<any, any>): number {
  return scope.kind === 'none' ? 0 : scope.count;
}

/**
 * Zamienia zasięg na cele operacji masowej. Jedyne miejsce w kodzie, które decyduje
 * „uuidy czy filtr" — komponenty nie powinny składać `ErpBatchTargets` ręcznie.
 */
export function erpBuildBatchTargets<TFilter>(
  scope: ErpSelectionScope<any, TFilter>,
): ErpBatchTargets<TFilter> {
  switch (scope.kind) {
    case 'explicit':
      return { targetUuids: scope.ids };
    case 'query':
      return { targetFilter: scope.filter };
    default:
      return {};
  }
}

