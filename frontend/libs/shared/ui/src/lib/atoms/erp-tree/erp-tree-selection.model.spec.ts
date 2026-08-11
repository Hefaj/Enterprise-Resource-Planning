import { describe, expect, it } from 'vitest';
import {
  buildMarksBelowIndex,
  buildParentIndex,
  collapseCarvedOutAncestor,
  emptySelection,
  getNodeState,
  isEmptySelection,
  isNodeIncluded,
  normalize,
  parentResolverFromIndex,
  resolveCheckedIds,
  resolveSelectedItemCount,
  selectFullSubtree,
  setDescendantsOnly,
  setNodeChecked,
} from './erp-tree-selection.model';

/**
 * Drzewo testowe:
 * root
 * ├── elektronika
 * │   ├── agd
 * │   │   ├── pralki
 * │   │   └── zmywarki
 * │   └── rtv
 * └── odziez
 *     └── meska
 */
const TREE: Record<string, string | null> = {
  elektronika: null,
  agd: 'elektronika',
  pralki: 'agd',
  zmywarki: 'agd',
  rtv: 'elektronika',
  odziez: null,
  meska: 'odziez',
};

const parentIndex = new Map(Object.entries(TREE));
const getParentId = parentResolverFromIndex(parentIndex);
const ALL_IDS = Object.keys(TREE);
const getChildrenIds = (parentId: string) => ALL_IDS.filter((id) => TREE[id] === parentId);

describe('erp-tree-selection.model — cascade: none', () => {
  it('zaznaczenie i odznaczenie węzła jest niezależne od dzieci', () => {
    let value = emptySelection();
    value = setNodeChecked('agd', true, value, 'none', getParentId);
    expect(isNodeIncluded('agd', value, 'none', getParentId)).toBe(true);
    expect(isNodeIncluded('pralki', value, 'none', getParentId)).toBe(false);

    const marksBelow = buildMarksBelowIndex(value, 'none', getParentId);
    expect(getNodeState('agd', value, 'none', getParentId, marksBelow)).toBe('checked');
    expect(getNodeState('pralki', value, 'none', getParentId, marksBelow)).toBe('unchecked');
  });
});

describe('erp-tree-selection.model — cascade: subtree', () => {
  it('zaznaczenie rodzica pokrywa wszystkich potomków bez ich wypisywania', () => {
    let value = emptySelection();
    value = setNodeChecked('elektronika', true, value, 'subtree', getParentId);

    expect(value.subtreeRoots).toEqual(['elektronika']);
    for (const id of ['agd', 'pralki', 'zmywarki', 'rtv']) {
      expect(isNodeIncluded(id, value, 'subtree', getParentId)).toBe(true);
    }
    expect(isNodeIncluded('meska', value, 'subtree', getParentId)).toBe(false);

    const marksBelow = buildMarksBelowIndex(value, 'subtree', getParentId);
    expect(getNodeState('elektronika', value, 'subtree', getParentId, marksBelow)).toBe('checked');
    expect(getNodeState('pralki', value, 'subtree', getParentId, marksBelow)).toBe('checked');
  });

  it('odznaczenie jednego dziecka w zaznaczonym poddrzewie tworzy wyjątek (excluded), bez pobierania rodzeństwa', () => {
    let value = emptySelection();
    value = setNodeChecked('agd', true, value, 'subtree', getParentId);
    value = setNodeChecked('pralki', false, value, 'subtree', getParentId);

    expect(value.subtreeRoots).toEqual(['agd']);
    expect(value.excluded).toEqual(['pralki']);
    expect(isNodeIncluded('pralki', value, 'subtree', getParentId)).toBe(false);
    expect(isNodeIncluded('zmywarki', value, 'subtree', getParentId)).toBe(true);

    const marksBelow = buildMarksBelowIndex(value, 'subtree', getParentId);
    expect(getNodeState('agd', value, 'subtree', getParentId, marksBelow)).toBe('indeterminate');
    expect(getNodeState('pralki', value, 'subtree', getParentId, marksBelow)).toBe('unchecked');
    expect(getNodeState('zmywarki', value, 'subtree', getParentId, marksBelow)).toBe('checked');
  });

  it('stan indeterminate rodzica jest wyliczany bez znajomości pełnego poddrzewa (server mode)', () => {
    // Resolver widzi TYLKO to, co "załadowane" — pralki i zmywarki nieznane (nierozwinięte).
    const partialParents = new Map<string, string | null>([
      ['elektronika', null],
      ['agd', 'elektronika'],
    ]);
    const partialResolver = parentResolverFromIndex(partialParents);

    let value = emptySelection();
    value = setNodeChecked('elektronika', true, value, 'subtree', partialResolver);
    value = setNodeChecked('agd', false, value, 'subtree', partialResolver);

    const marksBelow = buildMarksBelowIndex(value, 'subtree', partialResolver);
    expect(getNodeState('elektronika', value, 'subtree', partialResolver, marksBelow)).toBe('indeterminate');
    expect(getNodeState('agd', value, 'subtree', partialResolver, marksBelow)).toBe('unchecked');
  });

  it('setDescendantsOnly zaznacza dzieci bez rodzica (multi bez pojedynczego elementu)', () => {
    let value = emptySelection();
    value = setDescendantsOnly('agd', value, 'subtree', getParentId);

    expect(value.subtreeRoots).toContain('agd');
    expect(value.excluded).toContain('agd');
    expect(isNodeIncluded('agd', value, 'subtree', getParentId)).toBe(false);
    expect(isNodeIncluded('pralki', value, 'subtree', getParentId)).toBe(true);
    expect(isNodeIncluded('zmywarki', value, 'subtree', getParentId)).toBe(true);

    // 'agd' samo w sobie jest odznaczone, ale ma zaznaczone wszystkie dzieci — checkbox musi
    // pokazywać stan pośredni ('indeterminate'), nie 'unchecked' (który sugerowałby, że nic
    // pod nim nie jest zaznaczone).
    const marksBelow = buildMarksBelowIndex(value, 'subtree', getParentId);
    expect(getNodeState('agd', value, 'subtree', getParentId, marksBelow)).toBe('indeterminate');
    expect(getNodeState('pralki', value, 'subtree', getParentId, marksBelow)).toBe('checked');
  });

  it('setDescendantsOnly na przodku PO wcześniejszym wyodrębnieniu zagnieżdżonego węzła nie kasuje jego osobnego wpisu w subtreeRoots', () => {
    let value = emptySelection();
    // Najpierw carve-out na 'agd' (jeszcze niczym niepokryty) — dostaje własną parę root+excluded.
    value = setDescendantsOnly('agd', value, 'subtree', getParentId);
    // Później carve-out na przodku 'elektronika'. 'agd' pozostaje wykluczone samo z siebie, więc
    // jego WŁASNY wpis w subtreeRoots (utrzymujący pokrycie pralki/zmywarki) nie może zostać
    // uznany przez normalize za redundantny, mimo że 'elektronika' teraz też formalnie go "pokrywa".
    value = setDescendantsOnly('elektronika', value, 'subtree', getParentId);

    expect(value.subtreeRoots).toContain('agd');
    expect(isNodeIncluded('agd', value, 'subtree', getParentId)).toBe(false);
    expect(isNodeIncluded('pralki', value, 'subtree', getParentId)).toBe(true);
    expect(isNodeIncluded('zmywarki', value, 'subtree', getParentId)).toBe(true);
    expect(isNodeIncluded('rtv', value, 'subtree', getParentId)).toBe(true);

    const marksBelow = buildMarksBelowIndex(value, 'subtree', getParentId);
    expect(getNodeState('agd', value, 'subtree', getParentId, marksBelow)).toBe('indeterminate');
    expect(getNodeState('pralki', value, 'subtree', getParentId, marksBelow)).toBe('checked');
    expect(getNodeState('rtv', value, 'subtree', getParentId, marksBelow)).toBe('checked');
  });

  it('setDescendantsOnly na już zaznaczonym (wprost) węźle nie wymusza jego wykluczenia — zostaje zaznaczony', () => {
    let value = emptySelection();
    value = setNodeChecked('agd', true, value, 'subtree', getParentId);
    value = setDescendantsOnly('agd', value, 'subtree', getParentId);

    expect(isNodeIncluded('agd', value, 'subtree', getParentId)).toBe(true);
    expect(value.excluded).not.toContain('agd');
    expect(isNodeIncluded('pralki', value, 'subtree', getParentId)).toBe(true);
    expect(isNodeIncluded('zmywarki', value, 'subtree', getParentId)).toBe(true);

    const marksBelow = buildMarksBelowIndex(value, 'subtree', getParentId);
    expect(getNodeState('agd', value, 'subtree', getParentId, marksBelow)).toBe('checked');
  });

  it('setDescendantsOnly na węźle zaznaczonym przez pokrycie od przodka też zostawia go zaznaczonym', () => {
    let value = emptySelection();
    value = setNodeChecked('elektronika', true, value, 'subtree', getParentId);
    value = setDescendantsOnly('agd', value, 'subtree', getParentId);

    expect(isNodeIncluded('agd', value, 'subtree', getParentId)).toBe(true);
    expect(value.excluded).not.toContain('agd');
    expect(isNodeIncluded('pralki', value, 'subtree', getParentId)).toBe(true);
    expect(isNodeIncluded('rtv', value, 'subtree', getParentId)).toBe(true);
  });

  it('collapseCarvedOutAncestor czyści rodzica po ręcznym odznaczeniu WSZYSTKICH dzieci wzorca "tylko dzieci"', () => {
    let value = emptySelection();
    value = setDescendantsOnly('agd', value, 'subtree', getParentId);

    // Odznaczam jedno z dwóch dzieci — 'agd' musi zostać 'indeterminate' (zmywarki wciąż zaznaczone).
    value = setNodeChecked('pralki', false, value, 'subtree', getParentId);
    value = collapseCarvedOutAncestor('pralki', value, 'subtree', getParentId, getChildrenIds);

    let marksBelow = buildMarksBelowIndex(value, 'subtree', getParentId);
    expect(getNodeState('agd', value, 'subtree', getParentId, marksBelow)).toBe('indeterminate');
    expect(isNodeIncluded('zmywarki', value, 'subtree', getParentId)).toBe(true);

    // Odznaczam OSTATNIE pozostałe dziecko — nic w poddrzewie 'agd' nie jest już zaznaczone,
    // więc 'agd' musi wrócić do 'unchecked', nie zostać fałszywie 'indeterminate'.
    value = setNodeChecked('zmywarki', false, value, 'subtree', getParentId);
    value = collapseCarvedOutAncestor('zmywarki', value, 'subtree', getParentId, getChildrenIds);

    expect(value.subtreeRoots).not.toContain('agd');
    expect(value.excluded).not.toContain('agd');
    expect(value.excluded).not.toContain('pralki');
    expect(value.excluded).not.toContain('zmywarki');
    expect(isEmptySelection(value)).toBe(true);

    marksBelow = buildMarksBelowIndex(value, 'subtree', getParentId);
    expect(getNodeState('agd', value, 'subtree', getParentId, marksBelow)).toBe('unchecked');
  });

  it('collapseCarvedOutAncestor nie ingeruje, gdy lista dzieci rodzica nie jest w pełni znana (server, częściowe stronicowanie)', () => {
    let value = emptySelection();
    value = setDescendantsOnly('agd', value, 'subtree', getParentId);
    value = setNodeChecked('pralki', false, value, 'subtree', getParentId);
    value = setNodeChecked('zmywarki', false, value, 'subtree', getParentId);

    const partialChildren = () => null; // symuluje niedoładowaną stronę dzieci
    const collapsed = collapseCarvedOutAncestor('zmywarki', value, 'subtree', getParentId, partialChildren);

    expect(collapsed).toBe(value);
    expect(collapsed.subtreeRoots).toContain('agd');
  });

  it('ponowne zaznaczenie wcześniej wykluczonego dziecka czyści wyjątek (normalize usuwa martwy excluded)', () => {
    let value = emptySelection();
    value = setNodeChecked('agd', true, value, 'subtree', getParentId);
    value = setNodeChecked('pralki', false, value, 'subtree', getParentId);
    value = setNodeChecked('pralki', true, value, 'subtree', getParentId);

    expect(value.excluded).toEqual([]);
    expect(value.subtreeRoots).toEqual(['agd']);
  });

  it('ponowne zaznaczenie wnuka (2 poziomy niżej) wewnątrz wykluczonego dziecka przywraca go do zaznaczenia', () => {
    // Powtórzenie zgłoszonego buga: elektronika (root) -> agd (excluded) -> pralki (re-included).
    // normalize() nie może uznać własnego wpisu 'pralki' w subtreeRoots za redundantny tylko
    // dlatego, że jakiś DALSZY przodek (elektronika) jest korzeniem — bliższe wykluczenie 'agd'
    // blokuje to pokrycie po drodze.
    let value = emptySelection();
    value = setNodeChecked('elektronika', true, value, 'subtree', getParentId);
    value = setNodeChecked('agd', false, value, 'subtree', getParentId);
    value = setNodeChecked('pralki', true, value, 'subtree', getParentId);

    expect(isNodeIncluded('pralki', value, 'subtree', getParentId)).toBe(true);
    expect(isNodeIncluded('zmywarki', value, 'subtree', getParentId)).toBe(false);
    expect(isNodeIncluded('agd', value, 'subtree', getParentId)).toBe(false);
    expect(isNodeIncluded('rtv', value, 'subtree', getParentId)).toBe(true);
    expect(new Set(value.subtreeRoots)).toEqual(new Set(['elektronika', 'pralki']));
    expect(value.excluded).toEqual(['agd']);

    const marksBelow = buildMarksBelowIndex(value, 'subtree', getParentId);
    expect(getNodeState('pralki', value, 'subtree', getParentId, marksBelow)).toBe('checked');
    expect(getNodeState('zmywarki', value, 'subtree', getParentId, marksBelow)).toBe('unchecked');
    expect(getNodeState('agd', value, 'subtree', getParentId, marksBelow)).toBe('indeterminate');
  });

  it('po re-inkluzji wnuka, ponowne odznaczenie go z powrotem wraca do samego wykluczenia rodzica (bez osieroconych wpisów)', () => {
    let value = emptySelection();
    value = setNodeChecked('elektronika', true, value, 'subtree', getParentId);
    value = setNodeChecked('agd', false, value, 'subtree', getParentId);
    value = setNodeChecked('pralki', true, value, 'subtree', getParentId);
    value = setNodeChecked('pralki', false, value, 'subtree', getParentId);

    expect(value.subtreeRoots).toEqual(['elektronika']);
    expect(value.excluded).toEqual(['agd']);
    expect(isNodeIncluded('pralki', value, 'subtree', getParentId)).toBe(false);
    expect(isNodeIncluded('zmywarki', value, 'subtree', getParentId)).toBe(false);
  });

  it('normalize nie kasuje wykluczenia realnie pokrytego przez bliższy korzeń, mimo dalszego niepowiązanego wykluczenia w łańcuchu przodków', () => {
    // Skonstruowany ręcznie deskryptor (analogicznie do testu „zagnieżdżony subtreeRoot" niżej):
    // 'elektronika' w excluded to martwy szum (nic go nie pokrywa — usuwany), a 'pralki' jest
    // realnie pokryty przez bliższy korzeń 'agd' — musi PRZETRWAĆ, mimo że dalszy 'elektronika'
    // też formalnie jest w excluded.
    const value = normalize(
      { ids: [], subtreeRoots: ['agd'], excluded: ['elektronika', 'pralki'] },
      'subtree',
      getParentId,
    );

    expect(value.subtreeRoots).toEqual(['agd']);
    expect(value.excluded).toEqual(['pralki']);
    expect(isNodeIncluded('pralki', value, 'subtree', getParentId)).toBe(false);
    expect(isNodeIncluded('zmywarki', value, 'subtree', getParentId)).toBe(true);
  });

  it('zagnieżdżony subtreeRoot wewnątrz innego zaznaczonego poddrzewa jest normalizowany (usuwany jako nadmiarowy)', () => {
    const value = normalize(
      { ids: [], subtreeRoots: ['elektronika', 'agd'], excluded: [] },
      'subtree',
      getParentId,
    );
    expect(value.subtreeRoots).toEqual(['elektronika']);
  });

  it('odznaczenie całego zaznaczonego korzenia usuwa go, bez pozostawiania osieroconych wyjątków', () => {
    let value = emptySelection();
    value = setNodeChecked('elektronika', true, value, 'subtree', getParentId);
    value = setNodeChecked('pralki', false, value, 'subtree', getParentId);
    value = setNodeChecked('elektronika', false, value, 'subtree', getParentId);

    expect(value.subtreeRoots).toEqual([]);
    expect(value.excluded).toEqual([]);
    for (const id of ALL_IDS) {
      expect(isNodeIncluded(id, value, 'subtree', getParentId)).toBe(false);
    }
  });

  it('resolveCheckedIds materializuje deskryptor do płaskiej listy tylko w trybie client', () => {
    let value = emptySelection();
    value = setNodeChecked('elektronika', true, value, 'subtree', getParentId);
    value = setNodeChecked('pralki', false, value, 'subtree', getParentId);

    const resolved = resolveCheckedIds(ALL_IDS, value, 'subtree', getParentId);
    expect(new Set(resolved)).toEqual(new Set(['elektronika', 'agd', 'zmywarki', 'rtv']));
  });

  it('buildParentIndex poprawnie odwzorowuje płaską listę na resolver rodzica', () => {
    const items = [
      { id: 'a', parent: null },
      { id: 'b', parent: 'a' },
    ];
    const index = buildParentIndex(items, (i) => i.id, (i) => i.parent);
    expect(index.get('b')).toBe('a');
    expect(index.get('a')).toBe(null);
  });

  it('selectFullSubtree dopełnia węzeł w stanie indeterminate — czyści wyjątki w jego poddrzewie', () => {
    let value = emptySelection();
    value = setNodeChecked('elektronika', true, value, 'subtree', getParentId);
    value = setNodeChecked('pralki', false, value, 'subtree', getParentId);
    expect(isNodeIncluded('pralki', value, 'subtree', getParentId)).toBe(false);

    value = selectFullSubtree('elektronika', value, 'subtree', getParentId);

    expect(value.excluded).toEqual([]);
    for (const id of ['elektronika', 'agd', 'pralki', 'zmywarki', 'rtv']) {
      expect(isNodeIncluded(id, value, 'subtree', getParentId)).toBe(true);
    }
    expect(isNodeIncluded('meska', value, 'subtree', getParentId)).toBe(false);
    const marksBelow = buildMarksBelowIndex(value, 'subtree', getParentId);
    expect(getNodeState('elektronika', value, 'subtree', getParentId, marksBelow)).toBe('checked');
  });
});

describe('erp-tree-selection.model — resolveSelectedItemCount', () => {
  // Rekurencyjna, łączna liczba potomków (nie tylko dzieci bezpośrednich) — jak DescendantCount z backendu.
  const DESCENDANT_COUNTS: Record<string, number> = {
    elektronika: 4, // agd, pralki, zmywarki, rtv
    agd: 2, // pralki, zmywarki
    pralki: 0,
    zmywarki: 0,
    rtv: 0,
    odziez: 1, // meska
    meska: 0,
  };
  const getDescendantCount = (id: string) => DESCENDANT_COUNTS[id];

  it('cascade none liczy po prostu liczbę id, niezależnie od descendantCount', () => {
    const value = { ids: ['pralki', 'rtv'], subtreeRoots: [], excluded: [] };
    expect(resolveSelectedItemCount(value, 'none', getParentId, getDescendantCount)).toBe(2);
  });

  it('pojedynczy liść bez potomków liczy się jako 1', () => {
    let value = emptySelection();
    value = setNodeChecked('pralki', true, value, 'subtree', getParentId);
    expect(resolveSelectedItemCount(value, 'subtree', getParentId, getDescendantCount)).toBe(1);
  });

  it('zaznaczenie rodzica kaskadowo liczy siebie + WSZYSTKICH potomków, nie tylko 1 znacznik', () => {
    let value = emptySelection();
    value = setNodeChecked('elektronika', true, value, 'subtree', getParentId);
    // elektronika + agd + pralki + zmywarki + rtv = 5, mimo że to tylko 1 wpis w subtreeRoots.
    expect(resolveSelectedItemCount(value, 'subtree', getParentId, getDescendantCount)).toBe(5);
  });

  it('wzorzec "tylko dzieci" liczy dzieci, BEZ samego rodzica (nie 1, jak sugerowałby countMarks)', () => {
    let value = emptySelection();
    value = setDescendantsOnly('agd', value, 'subtree', getParentId);
    // pralki + zmywarki = 2, 'agd' samo nie jest zaznaczone.
    expect(resolveSelectedItemCount(value, 'subtree', getParentId, getDescendantCount)).toBe(2);
  });

  it('wyjątek (excluded) w zaznaczonym poddrzewie odejmuje całe swoje poddrzewo od pokrycia rodzica', () => {
    let value = emptySelection();
    value = setNodeChecked('elektronika', true, value, 'subtree', getParentId);
    value = setNodeChecked('agd', false, value, 'subtree', getParentId);
    // pełne elektronika = 5, minus całe agd (agd+pralki+zmywarki = 3) = elektronika + rtv = 2.
    expect(resolveSelectedItemCount(value, 'subtree', getParentId, getDescendantCount)).toBe(2);
  });

  it('re-inkluzja bezpośredniego dziecka wykluczonego rodzica dolicza z powrotem jego poddrzewo', () => {
    let value = emptySelection();
    value = setNodeChecked('elektronika', true, value, 'subtree', getParentId);
    value = setNodeChecked('rtv', false, value, 'subtree', getParentId);
    value = setNodeChecked('rtv', true, value, 'subtree', getParentId);
    // Powrót do pełnego elektronika: elektronika + agd + pralki + zmywarki + rtv = 5.
    expect(resolveSelectedItemCount(value, 'subtree', getParentId, getDescendantCount)).toBe(5);
  });

  it('kilka niezależnych zaznaczeń sumuje się poprawnie', () => {
    let value = emptySelection();
    value = setNodeChecked('rtv', true, value, 'subtree', getParentId);
    value = setNodeChecked('meska', true, value, 'subtree', getParentId);
    expect(resolveSelectedItemCount(value, 'subtree', getParentId, getDescendantCount)).toBe(2);
  });

  it('zwraca null, gdy descendantCount zaznaczonego węzła jest nieznany', () => {
    let value = emptySelection();
    value = setNodeChecked('elektronika', true, value, 'subtree', getParentId);
    expect(resolveSelectedItemCount(value, 'subtree', getParentId, () => undefined)).toBeNull();
  });

  it('pusta selekcja liczy się jako 0', () => {
    expect(resolveSelectedItemCount(emptySelection(), 'subtree', getParentId, getDescendantCount)).toBe(0);
  });
});
