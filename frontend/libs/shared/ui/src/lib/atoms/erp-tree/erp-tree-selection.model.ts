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
export function getAncestorChain(id: string, getParentId: ErpTreeParentResolver, maxDepth = 128): string[] {
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

  // Węzeł jednocześnie będący korzeniem poddrzewa i wykluczeniem — wzorzec „poddrzewo X bez
  // samego X” (zaznacz dzieci X, zostawiając X odznaczonym). `buildMarksBelowIndex` nie widzi
  // tego przypadku: liczy tylko znaczniki w ŚCISŁYM poddrzewie węzła (idąc od znacznika w górę
  // do przodków), a własny znacznik węzła nigdy nie jest swoim własnym przodkiem. Bez tej reguły
  // X wypadał jako 'unchecked' (bo `isNodeIncluded` rozstrzyga „wykluczony” dla samego siebie),
  // mimo że realnie ma zaznaczone wszystkie dzieci.
  if (value.subtreeRoots.includes(id) && value.excluded.includes(id)) return 'indeterminate';

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
 * Zaznacza dzieci węzła, NIE zmieniając własnego stanu zaznaczenia węzła — jeśli węzeł nie był
 * zaznaczony, zostaje niezaznaczony (wzorzec `subtreeRoots: [id], excluded: [id]` — "tylko
 * dzieci"); jeśli już był zaznaczony (wprost albo przez pokrycie od przodka), zostaje zaznaczony
 * nadal — akcja wtedy sprowadza się do dociągnięcia pełnego pokrycia jego poddrzewa
 * (`selectFullSubtree`), bez wymuszania na nim wykluczenia. Dostępne wyłącznie w trybie
 * multi + cascade='subtree'.
 */
export function setDescendantsOnly(
  id: string,
  value: ErpTreeSelectionValue,
  cascade: ErpTreeCascadeMode,
  getParentId: ErpTreeParentResolver,
): ErpTreeSelectionValue {
  if (cascade !== 'subtree') return value;

  if (isNodeIncluded(id, value, cascade, getParentId)) {
    return selectFullSubtree(id, value, cascade, getParentId);
  }

  const roots = new Set(value.subtreeRoots);
  const excluded = new Set(value.excluded);
  roots.add(id);
  excluded.add(id);
  return normalize({ ids: [], subtreeRoots: [...roots], excluded: [...excluded] }, cascade, getParentId);
}

/** Zwraca DIRECT dzieci węzła, albo `null` gdy nie wszystkie są jeszcze znane (np. stronicowanie
 * server, doładowana tylko część strony) — w tym wypadku wołający nie powinien zgadywać. */
export type ErpTreeChildrenResolver = (parentId: string) => readonly string[] | null;

/**
 * Po ręcznym odznaczeniu węzła sprawdza, czy jego rodzic — jeśli jest samoreferencyjnym
 * wzorcem „poddrzewo X bez samego X” (`subtreeRoots: [X], excluded: [X]`, patrz `setDescendantsOnly`)
 * — stracił przez to CAŁE pokrycie: każde jego bezpośrednie dziecko wylądowało w `excluded`.
 * W takim wypadku deskryptor formalnie nadal ma X w `subtreeRoots`, więc `getNodeState` pokazywałby
 * dla X 'indeterminate', mimo że realnie nic w jego poddrzewie nie jest już zaznaczone (skoro
 * KAŻDE bezpośrednie dziecko blokuje pokrycie dla siebie i swoich potomków, całe poddrzewo X
 * jest puste — nie trzeba schodzić głębiej niż jeden poziom, żeby to stwierdzić).
 *
 * Usuwa wtedy X z `subtreeRoots`; `normalize` sam posprząta osierocone wpisy `excluded` (X
 * i jego dzieci przestają być czymkolwiek pokryte, więc przestają być potrzebne).
 *
 * Wymaga `getChildrenIds` zwracającego PEŁNĄ, znaną listę dzieci rodzica — przy niepełnym
 * stronicowaniu (server mode, nie wszystkie strony doładowane) zwróć `null` i funkcja nie
 * ingeruje (nie da się bezpiecznie stwierdzić „wszystkie dzieci wykluczone” bez znajomości
 * wszystkich dzieci).
 */
export function collapseCarvedOutAncestor(
  uncheckedId: string,
  value: ErpTreeSelectionValue,
  cascade: ErpTreeCascadeMode,
  getParentId: ErpTreeParentResolver,
  getChildrenIds: ErpTreeChildrenResolver,
): ErpTreeSelectionValue {
  if (cascade !== 'subtree') return value;

  const parentId = getParentId(uncheckedId);
  if (!parentId) return value;

  const roots = new Set(value.subtreeRoots);
  const excluded = new Set(value.excluded);
  if (!roots.has(parentId) || !excluded.has(parentId)) return value;

  const children = getChildrenIds(parentId);
  if (!children || children.length === 0) return value;
  if (!children.every((childId) => excluded.has(childId))) return value;

  roots.delete(parentId);
  return normalize({ ids: [...value.ids], subtreeRoots: [...roots], excluded: [...excluded] }, cascade, getParentId);
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
  const excludedInput = new Set(value.excluded);
  for (const r of [...roots]) {
    // Węzeł jednocześnie będący korzeniem i wykluczeniem to wzorzec „tylko dzieci"
    // (`setDescendantsOnly`) — mimo że przodek już go pokrywa, NIE jest redundantny: to jego
    // własny wpis w `roots` utrzymuje pokrycie JEGO dzieci. Pokrycie od przodka zatrzymuje się
    // na wykluczeniu samego r (patrz `resolveAncestorCoverage`), więc usunięcie r z `roots`
    // odcięłoby całe jego poddrzewo od pokrycia, zamiast tylko odznaczyć r.
    if (excludedInput.has(r)) continue;
    // `resolveAncestorCoverage`, nie `.some((a) => roots.has(a))` — musi zatrzymać się na
    // najbliższym BLOKUJĄCYM wykluczeniu po drodze do r. Sam fakt, że JAKIŚ dalszy przodek
    // jest korzeniem, nie czyni r redundantnym, jeśli bliższe wykluczenie odcina to pokrycie
    // (np. r=pralki pod wykluczonym agd, mimo że elektronika wyżej jest korzeniem).
    if (resolveAncestorCoverage(r, roots, excludedInput, getParentId)) {
      roots.delete(r);
    }
  }

  const excluded = new Set(value.excluded);
  for (const e of [...excluded]) {
    // Ta sama zasada co przy `roots` wyżej: wykluczenie e ma sens tylko, jeśli pokrycie od
    // przodka faktycznie do niego dociera bez przerwania przez bliższe wykluczenie po drodze
    // (albo e samo jest korzeniem — wzorzec „tylko dzieci"). Bez `resolveAncestorCoverage`
    // dalszy, niepowiązany przodek-wykluczenie mógłby błędnie „unieważnić" bliższe pokrycie.
    const coveredBySelf = roots.has(e);
    const coveredByAncestor = resolveAncestorCoverage(e, roots, excluded, getParentId);
    if (!coveredBySelf && !coveredByAncestor) {
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

/** Zwraca `descendantCount` węzła (łączna, rekurencyjna liczba potomków), albo `undefined`
 * gdy nieznana — patrz `ErpTreeDescendantCountResolver`. */
export type ErpTreeDescendantCountResolver = (id: string) => number | undefined;

/**
 * Realna liczba pojedynczych zaznaczonych elementów pokrywanych przez deskryptor — w
 * odróżnieniu od `countMarks`, które liczy tylko znaczniki (korzenie poddrzew/wykluczenia),
 * a nie faktyczną liczbę elementów, które te korzenie kaskadowo pokrywają (np. zaznaczenie
 * jednego rodzica z 4 potomkami to 1 znacznik, ale 5 realnie zaznaczonych elementów).
 *
 * Przetwarza znaczniki (`subtreeRoots ∪ excluded`) jako las uporządkowany relacją
 * przodek/potomek (przez `getAncestorChain`) i rekurencyjnie odejmuje/dodaje wkład zagnieżdżonych
 * wyjątków/re-inkluzji względem domyślnego pokrycia najbliższego przodka-znacznika. Wymaga
 * `descendantCount` każdego węzła-znacznika — te węzły są zawsze znane wywołującemu, bo
 * użytkownik musiał je zobaczyć/kliknąć, by je zaznaczyć/wykluczyć.
 *
 * Zwraca `null`, gdy któregoś `descendantCount` nie da się ustalić — wywołujący powinien
 * wtedy spaść do przybliżenia (np. `countMarks`), zamiast pokazać błędną liczbę.
 */
export function resolveSelectedItemCount(
  value: ErpTreeSelectionValue,
  cascade: ErpTreeCascadeMode,
  getParentId: ErpTreeParentResolver,
  getDescendantCount: ErpTreeDescendantCountResolver,
): number | null {
  if (cascade === 'none') return value.ids.length;

  const roots = new Set(value.subtreeRoots);
  const excluded = new Set(value.excluded);
  const marks = new Set<string>([...roots, ...excluded]);
  if (marks.size === 0) return 0;

  const childrenOfMark = new Map<string, string[]>();
  const topLevel: string[] = [];
  for (const m of marks) {
    const ancestorMark = getAncestorChain(m, getParentId).find((a) => marks.has(a));
    if (ancestorMark) {
      const siblings = childrenOfMark.get(ancestorMark) ?? [];
      siblings.push(m);
      childrenOfMark.set(ancestorMark, siblings);
    } else {
      topLevel.push(m);
    }
  }

  const compute = (m: string): number | null => {
    const subtreeDefaultIncluded = roots.has(m);
    const isExcluded = excluded.has(m);

    let subtreeTotal = 0;
    if (subtreeDefaultIncluded) {
      const dc = getDescendantCount(m);
      if (dc === undefined) return null;
      subtreeTotal = dc;
    }

    for (const child of childrenOfMark.get(m) ?? []) {
      const childDc = getDescendantCount(child);
      if (childDc === undefined) return null;
      const childDefaultCount = subtreeDefaultIncluded ? 1 + childDc : 0;
      const childActual = compute(child);
      if (childActual === null) return null;
      subtreeTotal += childActual - childDefaultCount;
    }

    return (isExcluded ? 0 : 1) + subtreeTotal;
  };

  let total = value.ids.length;
  for (const m of topLevel) {
    const c = compute(m);
    if (c === null) return null;
    total += c;
  }
  return total;
}
