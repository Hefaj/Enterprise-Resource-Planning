/**
 * Czysta logika selekcji drzewa — bez Angulara, bez wiedzy o strukturze komponentu.
 *
 * Selekcja NIE jest listą uuid (nie skaluje się do drzew z dziesiątkami tysięcy węzłów —
 * zaznaczenie korzenia nie może wymagać wypisania wszystkich potomków). Zamiast tego jest
 * deskryptorem: `ids` (dla trybu cascade='none', niezależne znaczniki per węzeł) albo
 * `subtreeRoots` + `excluded` (dla trybu cascade='subtree', poddrzewa z wyjątkami).
 *
 * Wzorzec `subtreeRoots: [X], excluded: [X]` to "zaznacz dzieci X bez samego X" —
 * węzeł jest jednocześnie korzeniem poddrzewa (pokrywa potomków) i wykluczony (siebie samego).
 */

export type ErpTreeCascadeMode = 'none' | 'subtree';
export type ErpTreeNodeCheckState = 'checked' | 'unchecked' | 'indeterminate';

export interface ErpTreeSelectionValue {
  /** Niezależne znaczniki węzłów — używane wyłącznie w trybie cascade='none'. */
  readonly ids: readonly string[];
  /** Korzenie zaznaczonych poddrzew — używane wyłącznie w trybie cascade='subtree'. */
  readonly subtreeRoots: readonly string[];
  /** Wykluczenia wewnątrz zaznaczonych poddrzew (carve-outs) — cascade='subtree'. */
  readonly excluded: readonly string[];
}

export type ErpTreeParentResolver = (id: string) => string | null | undefined;

export function emptySelection(): ErpTreeSelectionValue {
  return { ids: [], subtreeRoots: [], excluded: [] };
}

export function isEmptySelection(value: ErpTreeSelectionValue): boolean {
  return value.ids.length === 0 && value.subtreeRoots.length === 0 && value.excluded.length === 0;
}

/** Buduje resolver rodzica z płaskiej listy elementów — używane w trybie client. */
export function buildParentIndex<T>(
  items: readonly T[],
  getId: (item: T) => string,
  getParentId: (item: T) => string | null | undefined,
): Map<string, string | null> {
  const index = new Map<string, string | null>();
  for (const item of items) {
    index.set(getId(item), getParentId(item) ?? null);
  }
  return index;
}

export function parentResolverFromIndex(index: ReadonlyMap<string, string | null>): ErpTreeParentResolver {
  return (id) => index.get(id) ?? null;
}

/** Łańcuch przodków węzła, od najbliższego rodzica do korzenia (bez samego `id`). */
function getAncestorChain(id: string, getParentId: ErpTreeParentResolver, maxDepth = 128): string[] {
  const chain: string[] = [];
  const seen = new Set<string>([id]);
  let current = getParentId(id);
  let guard = 0;
  while (current && guard++ < maxDepth) {
    if (seen.has(current)) break; // zabezpieczenie przed cyklem w danych
    chain.push(current);
    seen.add(current);
    current = getParentId(current);
  }
  return chain;
}

/**
 * Czy węzeł dziedziczy zaznaczenie po przodkach (bez uwzględniania własnego znacznika `id`).
 * Idzie w górę od najbliższego rodzica — pierwszy napotkany przodek będący korzeniem poddrzewa
 * ("pokrywający") lub wykluczeniem bez własnego pokrycia ("blokujący") rozstrzyga wynik.
 * Przodek będący jednocześnie subtreeRoot i excluded (wzorzec "tylko dzieci") liczy się jako pokrywający —
 * to on decyduje o stanie SWOICH dzieci, jego własny stan rozstrzyga osobna reguła w `isNodeIncluded`.
 */
function resolveAncestorCoverage(
  id: string,
  roots: ReadonlySet<string>,
  excluded: ReadonlySet<string>,
  getParentId: ErpTreeParentResolver,
): boolean {
  for (const ancestorId of getAncestorChain(id, getParentId)) {
    const covering = roots.has(ancestorId);
    if (covering) return true;
    if (excluded.has(ancestorId)) return false;
  }
  return false;
}

/**
 * Czy węzeł jest częścią zaznaczenia (niezależnie od tego, co dzieje się w jego poddrzewie).
 * To źródło prawdy przy materializacji konkretnych uuid (`resolveCheckedIds`) — w odróżnieniu
 * od `getNodeState`, które dodatkowo pokazuje 'indeterminate', gdy poniżej węzła są wyjątki.
 */
export function isNodeIncluded(
  id: string,
  value: ErpTreeSelectionValue,
  cascade: ErpTreeCascadeMode,
  getParentId: ErpTreeParentResolver,
): boolean {
  if (cascade === 'none') {
    return value.ids.includes(id);
  }

  const excluded = new Set(value.excluded);
  if (excluded.has(id)) return false;

  const roots = new Set(value.subtreeRoots);
  if (roots.has(id)) return true;

  return resolveAncestorCoverage(id, roots, excluded, getParentId);
}

/**
 * Mapa "liczba znaczników (subtreeRoots/excluded) w ścisłym poddrzewie węzła" — do wykrywania
 * stanu 'indeterminate' bez znajomości pełnego poddrzewa. Koszt: O(liczba znaczników × głębokość),
 * niezależny od rozmiaru całego drzewa. Liczyć raz na zmianę `value`, nie per wiersz.
 */
export function buildMarksBelowIndex(
  value: ErpTreeSelectionValue,
  cascade: ErpTreeCascadeMode,
  getParentId: ErpTreeParentResolver,
): Map<string, number> {
  const index = new Map<string, number>();
  if (cascade === 'none') return index;

  const marks = new Set<string>([...value.subtreeRoots, ...value.excluded]);
  for (const markId of marks) {
    for (const ancestorId of getAncestorChain(markId, getParentId)) {
      index.set(ancestorId, (index.get(ancestorId) ?? 0) + 1);
    }
  }
  return index;
}

/** Stan checkboxa węzła do wyrenderowania. Wymaga `marksBelowIndex` z `buildMarksBelowIndex`. */
export function getNodeState(
  id: string,
  value: ErpTreeSelectionValue,
  cascade: ErpTreeCascadeMode,
  getParentId: ErpTreeParentResolver,
  marksBelowIndex: ReadonlyMap<string, number>,
): ErpTreeNodeCheckState {
  if (cascade === 'none') {
    return value.ids.includes(id) ? 'checked' : 'unchecked';
  }

  if ((marksBelowIndex.get(id) ?? 0) > 0) return 'indeterminate';
  return isNodeIncluded(id, value, cascade, getParentId) ? 'checked' : 'unchecked';
}

/** Zaznacza/odznacza pojedynczy węzeł, z kaskadą zgodną z `cascade`. */
export function setNodeChecked(
  id: string,
  checked: boolean,
  value: ErpTreeSelectionValue,
  cascade: ErpTreeCascadeMode,
  getParentId: ErpTreeParentResolver,
): ErpTreeSelectionValue {
  if (cascade === 'none') {
    const ids = new Set(value.ids);
    checked ? ids.add(id) : ids.delete(id);
    return { ids: [...ids], subtreeRoots: [], excluded: [] };
  }

  const roots = new Set(value.subtreeRoots);
  const excluded = new Set(value.excluded);

  if (checked) {
    excluded.delete(id);
    if (!roots.has(id) && !resolveAncestorCoverage(id, roots, excluded, getParentId)) {
      roots.add(id);
    }
  } else {
    if (roots.has(id)) {
      roots.delete(id);
    } else if (resolveAncestorCoverage(id, roots, excluded, getParentId)) {
      excluded.add(id);
    }
  }

  return normalize({ ids: [], subtreeRoots: [...roots], excluded: [...excluded] }, cascade, getParentId);
}

/**
 * Dopełnia zaznaczenie węzła w stanie 'indeterminate' do pełnego poddrzewa — czyści
 * wszystkie wyjątki (`excluded`) leżące w jego obrębie, zamiast tylko dodać sam węzeł
 * jako korzeń (którym w stanie 'indeterminate' już jest). Używane po kliknięciu wizualnego
 * wskaźnika stanu częściowego — konwencja "kliknięcie 'częściowo zaznaczone' zaznacza wszystko".
 */
export function selectFullSubtree(
  id: string,
  value: ErpTreeSelectionValue,
  cascade: ErpTreeCascadeMode,
  getParentId: ErpTreeParentResolver,
): ErpTreeSelectionValue {
  if (cascade === 'none') {
    return setNodeChecked(id, true, value, cascade, getParentId);
  }

  const roots = new Set(value.subtreeRoots);
  const excluded = new Set(value.excluded);
  excluded.delete(id);
  if (!roots.has(id) && !resolveAncestorCoverage(id, roots, excluded, getParentId)) {
    roots.add(id);
  }
  for (const e of [...excluded]) {
    if (e === id || getAncestorChain(e, getParentId).includes(id)) {
      excluded.delete(e);
    }
  }

  return normalize({ ids: [], subtreeRoots: [...roots], excluded: [...excluded] }, cascade, getParentId);
}

/**
 * Zaznacza "dzieci węzła bez samego węzła" — wzorzec `subtreeRoots: [id], excluded: [id]`.
 * Dostępne wyłącznie w trybie multi + cascade='subtree'.
 */
export function setDescendantsOnly(
  id: string,
  value: ErpTreeSelectionValue,
  cascade: ErpTreeCascadeMode,
  getParentId: ErpTreeParentResolver,
): ErpTreeSelectionValue {
  if (cascade !== 'subtree') return value;
  const roots = new Set(value.subtreeRoots);
  const excluded = new Set(value.excluded);
  roots.add(id);
  excluded.add(id);
  return normalize({ ids: [], subtreeRoots: [...roots], excluded: [...excluded] }, cascade, getParentId);
}

/**
 * Usuwa nadmiarowe znaczniki: zagnieżdżone korzenie poddrzew, wykluczenia niepokryte przez
 * żaden korzeń (poza wzorcem "tylko dzieci") i wykluczenia zagnieżdżone pod innym wykluczeniem.
 * Bez tego deskryptor rośnie bez ograniczeń przy powtarzalnym zaznaczaniu/odznaczaniu.
 */
export function normalize(
  value: ErpTreeSelectionValue,
  cascade: ErpTreeCascadeMode,
  getParentId: ErpTreeParentResolver,
): ErpTreeSelectionValue {
  if (cascade === 'none') {
    return { ids: [...new Set(value.ids)], subtreeRoots: [], excluded: [] };
  }

  const roots = new Set(value.subtreeRoots);
  for (const r of [...roots]) {
    if (getAncestorChain(r, getParentId).some((a) => roots.has(a))) {
      roots.delete(r);
    }
  }

  const excluded = new Set(value.excluded);
  for (const e of [...excluded]) {
    const coveredBySelf = roots.has(e);
    const coveredByAncestor = getAncestorChain(e, getParentId).some((a) => roots.has(a));
    if (!coveredBySelf && !coveredByAncestor) {
      excluded.delete(e);
    }
  }
  for (const e of [...excluded]) {
    const hasExcludedAncestor = getAncestorChain(e, getParentId).some((a) => a !== e && excluded.has(a) && !roots.has(a));
    if (hasExcludedAncestor) {
      excluded.delete(e);
    }
  }

  return { ids: [], subtreeRoots: [...roots], excluded: [...excluded] };
}

/**
 * Materializuje deskryptor do płaskiej listy zaznaczonych uuid — wyłącznie tryb client,
 * gdzie znamy wszystkie węzły. W trybie server ta funkcja nie ma zastosowania (dlatego
 * przyjmuje `allIds` wprost, zamiast czytać je z gdzieś globalnie).
 */
export function resolveCheckedIds(
  allIds: readonly string[],
  value: ErpTreeSelectionValue,
  cascade: ErpTreeCascadeMode,
  getParentId: ErpTreeParentResolver,
): string[] {
  return allIds.filter((id) => isNodeIncluded(id, value, cascade, getParentId));
}

/** Liczba "znaczników" w deskryptorze — do pokazania w UI (np. "Zaznaczono: 3 gałęzie"). */
export function countMarks(value: ErpTreeSelectionValue): number {
  return value.ids.length + value.subtreeRoots.length;
}
