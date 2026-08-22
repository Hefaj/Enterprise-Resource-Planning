/**
 * Czysta logika selekcji drzewa — bez Angulara, bez wiedzy o strukturze komponentu.
 *
 * **Kliknięcie checkboxa zaznacza WYŁĄCZNIE ten węzeł** — nigdy jego potomków. Zaznaczenie
 * całego poddrzewa to osobna, jawna akcja (`setDescendantsSelected`, w UI przycisk obok
 * checkboxa), która z kolei nie rusza własnego stanu węzła.
 *
 * Selekcja NIE jest listą uuid (nie skaluje się do drzew z dziesiątkami tysięcy węzłów —
 * zaznaczenie poddrzewa nie może wymagać wypisania wszystkich potomków). Jest deskryptorem
 * o dwóch rozłącznych warstwach:
 *  - `ids` — węzły zaznaczone SAME, klikiem w checkbox; zawsze włączone, niezależnie od
 *    pokrycia i wykluczeń (ta sama reguła co w backendowym `TreeSelectionResolver`),
 *  - `subtreeRoots` + `excluded` — pokrycie poddrzew z akcji „zaznacz potomków", z carve-outami
 *    po ręcznym odznaczeniu pojedynczych węzłów w środku.
 *
 * Korzeń pokrycia jest ZAWSZE zapisywany jako para `subtreeRoots: [X] + excluded: [X]`
 * („poddrzewo X bez samego X"): pokrycie z definicji dotyczy potomków, a własny stan X żyje
 * wyłącznie w `ids`. Dzięki temu obie warstwy nigdy nie walczą o ten sam węzeł.
 *
 * W trybie `cascade='none'` istnieje tylko `ids` — drzewo zachowuje się jak płaska lista.
 */

export type ErpTreeCascadeMode = 'none' | 'subtree';
/**
 * `'indeterminate'` — węzeł SAM nie jest zaznaczony, ale coś w jego poddrzewie jest. Stanu
 * „zaznaczony, ale nie wszystkie dzieci" nie ma: przy zaznaczaniu bez kaskady to normalny,
 * oczekiwany układ, a nie sytuacja wymagająca osobnego ostrzeżenia — ilu potomków jest
 * zaznaczonych, mówi licznik obok etykiety.
 */
export type ErpTreeNodeCheckState = 'checked' | 'unchecked' | 'indeterminate';

export interface ErpTreeSelectionValue {
  /** Węzły zaznaczone same z siebie (klik w checkbox) — zawsze włączone, bez wpływu na potomków. */
  readonly ids: readonly string[];
  /** Korzenie pokrytych poddrzew („zaznacz potomków") — używane wyłącznie w trybie cascade='subtree'. */
  readonly subtreeRoots: readonly string[];
  /** Wykluczenia wewnątrz pokrytych poddrzew (carve-outs) — cascade='subtree'. */
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
 * Domyślny stan pokrycia, jaki DZIEDZICZĄ dzieci węzła — świadomie z pominięciem `ids`, bo
 * własne zaznaczenie węzła nie kaskaduje w dół. Kolejność (`subtreeRoots` przed `excluded`)
 * musi być identyczna jak w `resolveAncestorCoverage`: korzeń pokrycia jest dla SIEBIE
 * wykluczony, ale dla swoich dzieci nadal pokrywający.
 */
export function resolveChildCoverage(
  id: string,
  value: ErpTreeSelectionValue,
  cascade: ErpTreeCascadeMode,
  getParentId: ErpTreeParentResolver,
): boolean {
  if (cascade === 'none') return false;

  const roots = new Set(value.subtreeRoots);
  if (roots.has(id)) return true;

  const excluded = new Set(value.excluded);
  if (excluded.has(id)) return false;

  return resolveAncestorCoverage(id, roots, excluded, getParentId);
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

  // Własne zaznaczenie węzła rozstrzyga przed pokryciem i wykluczeniami — węzeł może być
  // zaznaczony sam, mieszkając w środku wyciętego poddrzewa (i odwrotnie: korzeń pokrycia
  // jest dla siebie wykluczony, dopóki nie trafi do `ids`). Ta sama kolejność co w
  // `TreeSelectionResolver.IsIncluded` po stronie backendu.
  if (value.ids.includes(id)) return true;

  const excluded = new Set(value.excluded);
  if (excluded.has(id)) return false;

  const roots = new Set(value.subtreeRoots);
  if (roots.has(id)) return true;

  return resolveAncestorCoverage(id, roots, excluded, getParentId);
}

/**
 * Mapa "liczba znaczników (ids/subtreeRoots/excluded) w ścisłym poddrzewie węzła" — do wykrywania
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

  const marks = new Set<string>([...value.ids, ...value.subtreeRoots, ...value.excluded]);
  for (const markId of marks) {
    for (const ancestorId of getAncestorChain(markId, getParentId)) {
      index.set(ancestorId, (index.get(ancestorId) ?? 0) + 1);
    }
  }
  return index;
}

/**
 * Stan checkboxa węzła do wyrenderowania. Wymaga `marksBelowIndex` z `buildMarksBelowIndex`.
 *
 * Trzy stany wystarczają, bo klik nie kaskaduje: `'checked'` mówi wyłącznie o samym węźle,
 * a to, ilu jego potomków jest zaznaczonych, pokazuje osobny licznik. `'indeterminate'`
 * oznacza „sam niezaznaczony, ale coś pod nim jest" — łącznie z węzłem, którego potomkowie
 * zostali zaznaczeni przyciskiem (`subtreeRoots ∧ excluded`, pokrycie bez samego węzła).
 */
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

  if (isNodeIncluded(id, value, cascade, getParentId)) return 'checked';

  // Węzeł sam niezaznaczony: pokrycie jego potomków albo jakikolwiek znacznik niżej oznacza,
  // że w poddrzewie coś jednak jest zaznaczone.
  if (value.subtreeRoots.includes(id)) return 'indeterminate';

  return (marksBelowIndex.get(id) ?? 0) > 0 ? 'indeterminate' : 'unchecked';
}

/**
 * Zaznacza/odznacza POJEDYNCZY węzeł — nigdy jego potomków (patrz opis modułu).
 *
 * Odznaczenie węzła, który był zaznaczony nie własnym znacznikiem, tylko pokryciem poddrzewa
 * z góry, zapisuje się jako wykluczenie. Samo wykluczenie ucięłoby jednak także jego potomków
 * (pokrycie od przodka zatrzymuje się na pierwszym wykluczeniu), a odznaczenie ma dotyczyć
 * wyłącznie tego węzła — dlatego dla węzła z dziećmi dokładamy jego własny wpis w
 * `subtreeRoots`, czyli parę „poddrzewo X bez samego X". Dla liścia (`hasChildren: false`)
 * ten wpis byłby pokryciem nad pustką i fałszywie robił z niego węzeł „częściowo zaznaczony".
 */
export function setNodeChecked(
  id: string,
  checked: boolean,
  value: ErpTreeSelectionValue,
  cascade: ErpTreeCascadeMode,
  getParentId: ErpTreeParentResolver,
  options: { hasChildren?: boolean } = {},
): ErpTreeSelectionValue {
  if (cascade === 'none') {
    const ids = new Set(value.ids);
    checked ? ids.add(id) : ids.delete(id);
    return { ids: [...ids], subtreeRoots: [], excluded: [] };
  }

  const ids = new Set(value.ids);
  const roots = new Set(value.subtreeRoots);
  const excluded = new Set(value.excluded);

  if (checked) {
    ids.add(id);
  } else {
    ids.delete(id);
    const coveredFromAbove = !excluded.has(id) && resolveAncestorCoverage(id, roots, excluded, getParentId);
    if (coveredFromAbove) {
      excluded.add(id);
      if (options.hasChildren) roots.add(id);
    }
  }

  return normalize({ ids: [...ids], subtreeRoots: [...roots], excluded: [...excluded] }, cascade, getParentId);
}

/**
 * Zaznacza albo odznacza CAŁE poddrzewo węzła (wszystkich potomków, dowolnie głęboko), nie
 * ruszając własnego stanu węzła — akcja przycisku obok checkboxa. Pokrycie zapisuje się jako
 * para `subtreeRoots: [id] + excluded: [id]`, więc działa bez znajomości listy dzieci (tryb
 * server, niedoładowane strony). Wszystkie znaczniki wewnątrz poddrzewa znikają: operacja
 * ustawia jednolity stan całej gałęzi, a nie nakłada się na wcześniejsze wyjątki.
 *
 * Dostępna wyłącznie w trybie cascade='subtree'.
 */
export function setDescendantsSelected(
  id: string,
  selected: boolean,
  value: ErpTreeSelectionValue,
  cascade: ErpTreeCascadeMode,
  getParentId: ErpTreeParentResolver,
): ErpTreeSelectionValue {
  if (cascade !== 'subtree') return value;

  const ids = new Set(value.ids);
  const roots = new Set(value.subtreeRoots);
  const excluded = new Set(value.excluded);

  const isBelow = (markId: string) => markId !== id && getAncestorChain(markId, getParentId).includes(id);
  for (const set of [ids, roots, excluded]) {
    for (const markId of [...set]) {
      if (isBelow(markId)) set.delete(markId);
    }
  }

  // Obie gałęzie niżej mogą wykluczyć sam węzeł (pokrycie dotyczy potomków), więc jego własne
  // zaznaczenie — jeśli było — materializujemy do `ids`, gdzie żyje niezależnie od pokrycia.
  if (isNodeIncluded(id, value, cascade, getParentId)) ids.add(id);

  if (selected) {
    roots.add(id);
    excluded.add(id);
  } else {
    roots.delete(id);
    excluded.delete(id);
    // Pokrycie od przodka nadal sięgałoby w dół — trzeba je odciąć na tym węźle.
    if (resolveAncestorCoverage(id, roots, excluded, getParentId)) excluded.add(id);
  }

  return normalize({ ids: [...ids], subtreeRoots: [...roots], excluded: [...excluded] }, cascade, getParentId);
}

/**
 * Czy WSZYSCY potomkowie węzła są zaznaczeni — pokrycie dociera do jego dzieci i nie ma pod nim
 * ani jednego znacznika (wyjątku, własnego zaznaczenia, zagnieżdżonego pokrycia). Rozstrzyga,
 * czy przycisk „potomkowie" ma teraz zaznaczać, czy odznaczać, i czy pokazać go jako aktywny.
 */
export function areAllDescendantsSelected(
  id: string,
  value: ErpTreeSelectionValue,
  cascade: ErpTreeCascadeMode,
  getParentId: ErpTreeParentResolver,
  marksBelowIndex?: ReadonlyMap<string, number>,
): boolean {
  if (cascade !== 'subtree') return false;
  if (!resolveChildCoverage(id, value, cascade, getParentId)) return false;

  const index = marksBelowIndex ?? buildMarksBelowIndex(value, cascade, getParentId);
  return (index.get(id) ?? 0) === 0;
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
 * żaden korzeń (poza wzorcem „poddrzewo X bez samego X"), wykluczenia zagnieżdżone pod innym
 * wykluczeniem i własne zaznaczenia (`ids`) węzłów, które i tak są już pokryte poddrzewem
 * z góry. Bez tego deskryptor rośnie bez ograniczeń przy powtarzalnym zaznaczaniu/odznaczaniu,
 * a podwójnie policzone węzły zawyżają liczniki zaznaczenia.
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

  const ids = new Set(value.ids);
  for (const i of [...ids]) {
    // Własne zaznaczenie jest nadmiarowe tylko wtedy, gdy pokrycie z góry realnie do węzła
    // dociera — jego własne wykluczenie (wzorzec „poddrzewo bez samego siebie") to pokrycie
    // odcina, więc wtedy `ids` jest JEDYNYM nośnikiem zaznaczenia tego węzła.
    if (!excluded.has(i) && resolveAncestorCoverage(i, roots, excluded, getParentId)) {
      ids.delete(i);
    }
  }

  return { ids: [...ids], subtreeRoots: [...roots], excluded: [...excluded] };
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

/**
 * Liczba „znaczników" w deskryptorze — ile węzłów użytkownik dotknął (zaznaczył sam albo
 * zaznaczył ich potomków), a NIE ile elementów realnie obejmuje zaznaczenie (od tego jest
 * `resolveSelectedItemCount`). Węzeł zaznaczony sam i mający zaznaczonych potomków to jeden
 * znacznik, nie dwa.
 */
export function countMarks(value: ErpTreeSelectionValue): number {
  return new Set([...value.ids, ...value.subtreeRoots]).size;
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
/**
 * Grupuje płaski zbiór znaczników w las uporządkowany relacją przodek/potomek (przez
 * `getAncestorChain`) — dzieli je na `topLevel` (znaczniki bez żadnego innego znacznika
 * po drodze do korzenia) i `childrenOfMark` (bezpośrednie "dzieci-znaczniki" każdego
 * znacznika w tym lesie). Współdzielone przez `resolveSelectedItemCount` (las liczony
 * globalnie) i `resolveSelectedDescendantCount` (las ograniczony do poddrzewa węzła).
 */
function buildMarkTree(
  marks: ReadonlySet<string>,
  getParentId: ErpTreeParentResolver,
): { childrenOfMark: Map<string, string[]>; topLevel: string[] } {
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
  return { childrenOfMark, topLevel };
}

/**
 * Rekurencyjnie liczy realną liczbę zaznaczonych elementów pokrywanych przez znacznik `m`
 * (siebie + poddrzewo), odejmując/dodając wkład zagnieżdżonych wyjątków/re-inkluzji
 * względem domyślnego pokrycia `m`. Współdzielona przez `resolveSelectedItemCount` i
 * `resolveSelectedDescendantCount` — patrz `buildMarkTree`.
 */
function computeMarkCount(
  m: string,
  ids: ReadonlySet<string>,
  roots: ReadonlySet<string>,
  excluded: ReadonlySet<string>,
  childrenOfMark: ReadonlyMap<string, string[]>,
  getDescendantCount: ErpTreeDescendantCountResolver,
): number | null {
  const subtreeDefaultIncluded = roots.has(m);
  // Ta sama kolejność co w `isNodeIncluded`: własne zaznaczenie przed wykluczeniem.
  const selfIncluded = ids.has(m) || !excluded.has(m);

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
    const childActual = computeMarkCount(child, ids, roots, excluded, childrenOfMark, getDescendantCount);
    if (childActual === null) return null;
    subtreeTotal += childActual - childDefaultCount;
  }

  return (selfIncluded ? 1 : 0) + subtreeTotal;
}

export function resolveSelectedItemCount(
  value: ErpTreeSelectionValue,
  cascade: ErpTreeCascadeMode,
  getParentId: ErpTreeParentResolver,
  getDescendantCount: ErpTreeDescendantCountResolver,
): number | null {
  if (cascade === 'none') return value.ids.length;

  const ids = new Set(value.ids);
  const roots = new Set(value.subtreeRoots);
  const excluded = new Set(value.excluded);
  const marks = new Set<string>([...ids, ...roots, ...excluded]);
  if (marks.size === 0) return 0;

  const { childrenOfMark, topLevel } = buildMarkTree(marks, getParentId);

  let total = 0;
  for (const m of topLevel) {
    const c = computeMarkCount(m, ids, roots, excluded, childrenOfMark, getDescendantCount);
    if (c === null) return null;
    total += c;
  }
  return total;
}

/**
 * Jak `resolveSelectedItemCount`, ale ograniczone do poddrzewa JEDNEGO węzła `id` (BEZ
 * samego `id` — zgodnie z konwencją `descendantCount`, które też nie liczy siebie).
 * Traktuje `id` jako niejawny "wirtualny znacznik": jego własny stan pokrycia
 * (`isNodeIncluded`) kaskaduje w dół jako DOMYŚLNY stan wszystkiego poniżej, dokładnie
 * tak jak zrobiłby to realny `subtreeRoot` — `baselineDc` to liczba, jaka wyszłaby, gdyby
 * pod `id` nie było ŻADNYCH znaczników, a pętla po `topLevel` dokłada tę samą korektę
 * delta (`actual - default`), której `computeMarkCount` używa już wewnętrznie dla
 * zagnieżdżonych znaczników-dzieci.
 *
 * Zwraca `null`, gdy któregoś wymaganego `descendantCount` nie da się ustalić.
 */
export function resolveSelectedDescendantCount(
  id: string,
  value: ErpTreeSelectionValue,
  cascade: ErpTreeCascadeMode,
  getParentId: ErpTreeParentResolver,
  getDescendantCount: ErpTreeDescendantCountResolver,
): number | null {
  if (cascade === 'none') {
    let count = 0;
    for (const markedId of value.ids) {
      if (markedId !== id && getAncestorChain(markedId, getParentId).includes(id)) count++;
    }
    return count;
  }

  const ids = new Set(value.ids);
  const roots = new Set(value.subtreeRoots);
  const excluded = new Set(value.excluded);
  const allMarks = new Set<string>([...ids, ...roots, ...excluded]);

  // Domyślny stan pokrycia, jaki DZIEDZICZĄ dzieci `id` — to NIE to samo, co własne
  // zaznaczenie `id` (`isNodeIncluded`), bo klik w checkbox nie kaskaduje w dół.
  const childDefaultIncluded = resolveChildCoverage(id, value, cascade, getParentId);

  const baselineDc = childDefaultIncluded ? getDescendantCount(id) : 0;
  if (baselineDc === undefined) return null;

  const marksBelowId = new Set(
    [...allMarks].filter((m) => m !== id && getAncestorChain(m, getParentId).includes(id)),
  );
  if (marksBelowId.size === 0) return baselineDc;

  const { childrenOfMark, topLevel } = buildMarkTree(marksBelowId, getParentId);

  let total = baselineDc;
  for (const m of topLevel) {
    const mDc = getDescendantCount(m);
    if (mDc === undefined) return null;
    const defaultForM = childDefaultIncluded ? 1 + mDc : 0;
    const actualForM = computeMarkCount(m, ids, roots, excluded, childrenOfMark, getDescendantCount);
    if (actualForM === null) return null;
    total += actualForM - defaultForM;
  }
  return total;
}
