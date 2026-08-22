import { describe, expect, it } from 'vitest';
import {
  areAllDescendantsSelected,
  buildMarksBelowIndex,
  buildParentIndex,
  collapseCarvedOutAncestor,
  emptySelection,
  getNodeState,
  isEmptySelection,
  isNodeIncluded,
  normalize,
  parentResolverFromIndex,
  resolveChildCoverage,
  resolveCheckedIds,
  resolveSelectedDescendantCount,
  resolveSelectedItemCount,
  setDescendantsSelected,
  setNodeChecked,
} from './erp-tree-selection.model';

/**
 * Drzewo testowe:
 * elektronika
 * ├── agd
 * │   ├── pralki
 * │   └── zmywarki
 * └── rtv
 * odziez
 * └── meska
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

const stateOf = (id: string, value: Parameters<typeof getNodeState>[1]) =>
  getNodeState(id, value, 'subtree', getParentId, buildMarksBelowIndex(value, 'subtree', getParentId));

const allDescendants = (id: string, value: Parameters<typeof areAllDescendantsSelected>[1]) =>
  areAllDescendantsSelected(id, value, 'subtree', getParentId);

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

  it('setDescendantsSelected nie działa poza trybem subtree', () => {
    const value = setNodeChecked('agd', true, emptySelection(), 'none', getParentId);
    expect(setDescendantsSelected('agd', true, value, 'none', getParentId)).toBe(value);
    expect(areAllDescendantsSelected('agd', value, 'none', getParentId)).toBe(false);
  });
});

describe('erp-tree-selection.model — klik w checkbox zaznacza wyłącznie sam węzeł', () => {
  it('zaznaczenie rodzica NIE zaznacza jego potomków', () => {
    let value = emptySelection();
    value = setNodeChecked('elektronika', true, value, 'subtree', getParentId, { hasChildren: true });

    expect(value.ids).toEqual(['elektronika']);
    expect(value.subtreeRoots).toEqual([]);
    expect(isNodeIncluded('elektronika', value, 'subtree', getParentId)).toBe(true);
    for (const id of ['agd', 'pralki', 'zmywarki', 'rtv']) {
      expect(isNodeIncluded(id, value, 'subtree', getParentId)).toBe(false);
    }

    expect(stateOf('elektronika', value)).toBe('checked');
    expect(stateOf('agd', value)).toBe('unchecked');
  });

  it('rodzic niezaznaczonych sam, ale z zaznaczonym potomkiem, jest "indeterminate"', () => {
    let value = emptySelection();
    value = setNodeChecked('pralki', true, value, 'subtree', getParentId);

    expect(stateOf('pralki', value)).toBe('checked');
    expect(stateOf('agd', value)).toBe('indeterminate');
    expect(stateOf('elektronika', value)).toBe('indeterminate');
    expect(stateOf('odziez', value)).toBe('unchecked');
  });

  it('odznaczenie węzła pokrytego poddrzewem zostawia jego potomków zaznaczonych', () => {
    let value = setDescendantsSelected('elektronika', true, emptySelection(), 'subtree', getParentId);
    value = setNodeChecked('agd', false, value, 'subtree', getParentId, { hasChildren: true });

    expect(isNodeIncluded('agd', value, 'subtree', getParentId)).toBe(false);
    expect(isNodeIncluded('pralki', value, 'subtree', getParentId)).toBe(true);
    expect(isNodeIncluded('zmywarki', value, 'subtree', getParentId)).toBe(true);
    expect(isNodeIncluded('rtv', value, 'subtree', getParentId)).toBe(true);

    expect(stateOf('agd', value)).toBe('indeterminate');
    expect(stateOf('pralki', value)).toBe('checked');
  });

  it('odznaczony liść nie dostaje własnego pokrycia (nie udaje węzła częściowego)', () => {
    let value = setDescendantsSelected('agd', true, emptySelection(), 'subtree', getParentId);
    value = setNodeChecked('pralki', false, value, 'subtree', getParentId, { hasChildren: false });

    expect(value.subtreeRoots).not.toContain('pralki');
    expect(value.excluded).toContain('pralki');
    expect(stateOf('pralki', value)).toBe('unchecked');
    expect(stateOf('zmywarki', value)).toBe('checked');
  });

  it('ponowne zaznaczenie węzła wyciętego z poddrzewa nie przywraca jego potomków', () => {
    let value = setDescendantsSelected('elektronika', true, emptySelection(), 'subtree', getParentId);
    value = setNodeChecked('agd', false, value, 'subtree', getParentId, { hasChildren: true });
    value = setNodeChecked('pralki', false, value, 'subtree', getParentId, { hasChildren: false });
    value = setNodeChecked('agd', true, value, 'subtree', getParentId, { hasChildren: true });

    expect(isNodeIncluded('agd', value, 'subtree', getParentId)).toBe(true);
    expect(isNodeIncluded('pralki', value, 'subtree', getParentId)).toBe(false);
    expect(isNodeIncluded('zmywarki', value, 'subtree', getParentId)).toBe(true);
  });

  it('odznaczenie węzła zaznaczonego wprost po prostu usuwa go z ids', () => {
    let value = setNodeChecked('rtv', true, emptySelection(), 'subtree', getParentId);
    value = setNodeChecked('rtv', false, value, 'subtree', getParentId);
    expect(isEmptySelection(value)).toBe(true);
  });
});

describe('erp-tree-selection.model — akcja „potomkowie" (setDescendantsSelected)', () => {
  it('zaznacza całe poddrzewo, nie ruszając stanu samego węzła', () => {
    const value = setDescendantsSelected('agd', true, emptySelection(), 'subtree', getParentId);

    expect(isNodeIncluded('agd', value, 'subtree', getParentId)).toBe(false);
    expect(isNodeIncluded('pralki', value, 'subtree', getParentId)).toBe(true);
    expect(isNodeIncluded('zmywarki', value, 'subtree', getParentId)).toBe(true);

    expect(stateOf('agd', value)).toBe('indeterminate');
    expect(stateOf('pralki', value)).toBe('checked');
    expect(allDescendants('agd', value)).toBe(true);
  });

  it('sięga w głąb, nie tylko do bezpośrednich dzieci', () => {
    const value = setDescendantsSelected('elektronika', true, emptySelection(), 'subtree', getParentId);

    for (const id of ['agd', 'pralki', 'zmywarki', 'rtv']) {
      expect(isNodeIncluded(id, value, 'subtree', getParentId)).toBe(true);
    }
    expect(isNodeIncluded('meska', value, 'subtree', getParentId)).toBe(false);
    // Deskryptor zostaje zwięzły — bez wypisywania potomków.
    expect(value.subtreeRoots).toEqual(['elektronika']);
    expect(value.excluded).toEqual(['elektronika']);
  });

  it('zachowuje własne zaznaczenie węzła w obie strony', () => {
    let value = setNodeChecked('agd', true, emptySelection(), 'subtree', getParentId, { hasChildren: true });
    value = setDescendantsSelected('agd', true, value, 'subtree', getParentId);

    expect(isNodeIncluded('agd', value, 'subtree', getParentId)).toBe(true);
    expect(isNodeIncluded('pralki', value, 'subtree', getParentId)).toBe(true);
    expect(stateOf('agd', value)).toBe('checked');

    value = setDescendantsSelected('agd', false, value, 'subtree', getParentId);
    expect(isNodeIncluded('agd', value, 'subtree', getParentId)).toBe(true);
    expect(isNodeIncluded('pralki', value, 'subtree', getParentId)).toBe(false);
    expect(stateOf('agd', value)).toBe('checked');
  });

  it('odznaczenie potomków pod pokryciem przodka odcina tylko to poddrzewo', () => {
    let value = setDescendantsSelected('elektronika', true, emptySelection(), 'subtree', getParentId);
    value = setDescendantsSelected('agd', false, value, 'subtree', getParentId);

    // 'agd' było zaznaczone pokryciem elektroniki — jego własny stan zostaje.
    expect(isNodeIncluded('agd', value, 'subtree', getParentId)).toBe(true);
    expect(isNodeIncluded('pralki', value, 'subtree', getParentId)).toBe(false);
    expect(isNodeIncluded('zmywarki', value, 'subtree', getParentId)).toBe(false);
    // Rodzeństwo poza tym poddrzewem zostaje nietknięte.
    expect(isNodeIncluded('rtv', value, 'subtree', getParentId)).toBe(true);
  });

  it('ustawia jednolity stan gałęzi — czyści wcześniejsze wyjątki i znaczniki w poddrzewie', () => {
    let value = setDescendantsSelected('agd', true, emptySelection(), 'subtree', getParentId);
    value = setNodeChecked('pralki', false, value, 'subtree', getParentId, { hasChildren: false });
    expect(allDescendants('agd', value)).toBe(false);

    value = setDescendantsSelected('agd', true, value, 'subtree', getParentId);

    expect(value.excluded).toEqual(['agd']);
    expect(isNodeIncluded('pralki', value, 'subtree', getParentId)).toBe(true);
    expect(allDescendants('agd', value)).toBe(true);
  });

  it('działa bez znajomości listy dzieci (tryb server, niedoładowane strony)', () => {
    const partialParents = new Map<string, string | null>([
      ['elektronika', null],
      ['agd', 'elektronika'],
    ]);
    const partialResolver = parentResolverFromIndex(partialParents);

    const value = setDescendantsSelected('elektronika', true, emptySelection(), 'subtree', partialResolver);

    expect(value.subtreeRoots).toEqual(['elektronika']);
    expect(isNodeIncluded('agd', value, 'subtree', partialResolver)).toBe(true);
    expect(areAllDescendantsSelected('elektronika', value, 'subtree', partialResolver)).toBe(true);
  });

  it('areAllDescendantsSelected wykrywa każdy znacznik w poddrzewie', () => {
    const empty = emptySelection();
    expect(allDescendants('agd', empty)).toBe(false);

    const covered = setDescendantsSelected('elektronika', true, empty, 'subtree', getParentId);
    // Pokrycie od przodka liczy się tak samo jak własne.
    expect(allDescendants('agd', covered)).toBe(true);

    const withException = setNodeChecked('pralki', false, covered, 'subtree', getParentId, { hasChildren: false });
    expect(allDescendants('agd', withException)).toBe(false);
    expect(allDescendants('elektronika', withException)).toBe(false);
    expect(allDescendants('rtv', withException)).toBe(true);
  });

  it('resolveChildCoverage pomija własne zaznaczenie węzła (ono nie kaskaduje)', () => {
    const selfOnly = setNodeChecked('agd', true, emptySelection(), 'subtree', getParentId, { hasChildren: true });
    expect(isNodeIncluded('agd', selfOnly, 'subtree', getParentId)).toBe(true);
    expect(resolveChildCoverage('agd', selfOnly, 'subtree', getParentId)).toBe(false);
  });

  it('collapseCarvedOutAncestor czyści puste pokrycie po ręcznym odznaczeniu wszystkich dzieci', () => {
    let value = setDescendantsSelected('agd', true, emptySelection(), 'subtree', getParentId);

    value = setNodeChecked('pralki', false, value, 'subtree', getParentId, { hasChildren: false });
    value = collapseCarvedOutAncestor('pralki', value, 'subtree', getParentId, getChildrenIds);
    expect(stateOf('agd', value)).toBe('indeterminate');
    expect(isNodeIncluded('zmywarki', value, 'subtree', getParentId)).toBe(true);

    value = setNodeChecked('zmywarki', false, value, 'subtree', getParentId, { hasChildren: false });
    value = collapseCarvedOutAncestor('zmywarki', value, 'subtree', getParentId, getChildrenIds);

    expect(isEmptySelection(value)).toBe(true);
    expect(stateOf('agd', value)).toBe('unchecked');
  });

  it('collapseCarvedOutAncestor nie ingeruje, gdy lista dzieci nie jest w pełni znana', () => {
    let value = setDescendantsSelected('agd', true, emptySelection(), 'subtree', getParentId);
    value = setNodeChecked('pralki', false, value, 'subtree', getParentId, { hasChildren: false });
    value = setNodeChecked('zmywarki', false, value, 'subtree', getParentId, { hasChildren: false });

    const collapsed = collapseCarvedOutAncestor('zmywarki', value, 'subtree', getParentId, () => null);

    expect(collapsed).toBe(value);
    expect(collapsed.subtreeRoots).toContain('agd');
  });
});

describe('erp-tree-selection.model — normalize', () => {
  it('usuwa własne zaznaczenie węzła pokrytego już poddrzewem z góry', () => {
    const value = normalize(
      { ids: ['pralki'], subtreeRoots: ['agd'], excluded: ['agd'] },
      'subtree',
      getParentId,
    );
    expect(value.ids).toEqual([]);
    expect(isNodeIncluded('pralki', value, 'subtree', getParentId)).toBe(true);
  });

  it('zachowuje własne zaznaczenie węzła, którego poddrzewo jest wycięte', () => {
    const value = normalize(
      { ids: ['agd'], subtreeRoots: ['elektronika', 'agd'], excluded: ['elektronika', 'agd'] },
      'subtree',
      getParentId,
    );
    expect(value.ids).toEqual(['agd']);
    expect(isNodeIncluded('agd', value, 'subtree', getParentId)).toBe(true);
  });

  it('usuwa zagnieżdżony korzeń pokrycia bez własnego wykluczenia', () => {
    const value = normalize({ ids: [], subtreeRoots: ['elektronika', 'agd'], excluded: [] }, 'subtree', getParentId);
    expect(value.subtreeRoots).toEqual(['elektronika']);
  });

  it('zachowuje korzeń pokrycia zagnieżdżony pod innym, gdy sam jest wykluczony', () => {
    let value = setDescendantsSelected('agd', true, emptySelection(), 'subtree', getParentId);
    value = setDescendantsSelected('elektronika', true, value, 'subtree', getParentId);

    // Nadrzędna akcja czyści znaczniki w swoim poddrzewie — 'agd' jest teraz pokryte przez elektronikę.
    expect(value.subtreeRoots).toEqual(['elektronika']);
    expect(isNodeIncluded('agd', value, 'subtree', getParentId)).toBe(true);
    expect(isNodeIncluded('pralki', value, 'subtree', getParentId)).toBe(true);
  });

  it('usuwa wykluczenia, których nic nie pokrywa', () => {
    const value = normalize({ ids: [], subtreeRoots: ['agd'], excluded: ['elektronika', 'pralki'] }, 'subtree', getParentId);
    expect(value.subtreeRoots).toEqual(['agd']);
    expect(value.excluded).toEqual(['pralki']);
    expect(isNodeIncluded('zmywarki', value, 'subtree', getParentId)).toBe(true);
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

  it('resolveCheckedIds materializuje deskryptor do płaskiej listy (tryb client)', () => {
    let value = setNodeChecked('elektronika', true, emptySelection(), 'subtree', getParentId, { hasChildren: true });
    value = setDescendantsSelected('agd', true, value, 'subtree', getParentId);

    const resolved = resolveCheckedIds(ALL_IDS, value, 'subtree', getParentId);
    expect(new Set(resolved)).toEqual(new Set(['elektronika', 'pralki', 'zmywarki']));
  });
});

describe('erp-tree-selection.model — resolveSelectedItemCount', () => {
  const DESCENDANT_COUNTS: Record<string, number> = {
    elektronika: 4,
    agd: 2,
    pralki: 0,
    zmywarki: 0,
    rtv: 0,
    odziez: 1,
    meska: 0,
  };
  const getDescendantCount = (id: string) => DESCENDANT_COUNTS[id];
  const count = (value: Parameters<typeof resolveSelectedItemCount>[0]) =>
    resolveSelectedItemCount(value, 'subtree', getParentId, getDescendantCount);

  it('pusta selekcja liczy się jako 0', () => {
    expect(count(emptySelection())).toBe(0);
  });

  it('zaznaczenie rodzica to jeden element — potomkowie nie wchodzą', () => {
    const value = setNodeChecked('elektronika', true, emptySelection(), 'subtree', getParentId, { hasChildren: true });
    expect(count(value)).toBe(1);
  });

  it('akcja „potomkowie" liczy całe poddrzewo BEZ samego węzła', () => {
    const value = setDescendantsSelected('elektronika', true, emptySelection(), 'subtree', getParentId);
    expect(count(value)).toBe(4);
  });

  it('węzeł zaznaczony razem z potomkami liczy się z nimi', () => {
    let value = setNodeChecked('agd', true, emptySelection(), 'subtree', getParentId, { hasChildren: true });
    value = setDescendantsSelected('agd', true, value, 'subtree', getParentId);
    expect(count(value)).toBe(3);
  });

  it('wyjątki w środku pokrytego poddrzewa są odejmowane, a własne zaznaczenia doliczane', () => {
    let value = setDescendantsSelected('elektronika', true, emptySelection(), 'subtree', getParentId);
    value = setNodeChecked('agd', false, value, 'subtree', getParentId, { hasChildren: true });
    // agd wycięte, ale jego dzieci zostają: pralki + zmywarki + rtv = 3.
    expect(count(value)).toBe(3);

    value = setNodeChecked('pralki', false, value, 'subtree', getParentId, { hasChildren: false });
    expect(count(value)).toBe(2);

    value = setNodeChecked('agd', true, value, 'subtree', getParentId, { hasChildren: true });
    expect(count(value)).toBe(3);
  });

  it('kilka niezależnych zaznaczeń sumuje się poprawnie', () => {
    let value = setNodeChecked('rtv', true, emptySelection(), 'subtree', getParentId);
    value = setNodeChecked('meska', true, value, 'subtree', getParentId);
    expect(count(value)).toBe(2);
  });

  it('cascade none liczy po prostu liczbę id', () => {
    const value = { ids: ['pralki', 'rtv'], subtreeRoots: [], excluded: [] };
    expect(resolveSelectedItemCount(value, 'none', getParentId, getDescendantCount)).toBe(2);
  });

  it('zwraca null, gdy descendantCount pokrytego węzła jest nieznany', () => {
    const value = setDescendantsSelected('elektronika', true, emptySelection(), 'subtree', getParentId);
    expect(resolveSelectedItemCount(value, 'subtree', getParentId, () => undefined)).toBeNull();
  });
});

describe('erp-tree-selection.model — resolveSelectedDescendantCount', () => {
  const DESCENDANT_COUNTS: Record<string, number> = {
    elektronika: 4,
    agd: 2,
    pralki: 0,
    zmywarki: 0,
    rtv: 0,
    odziez: 1,
    meska: 0,
  };
  const getDescendantCount = (id: string) => DESCENDANT_COUNTS[id];
  const below = (id: string, value: Parameters<typeof resolveSelectedDescendantCount>[1]) =>
    resolveSelectedDescendantCount(id, value, 'subtree', getParentId, getDescendantCount);

  it('własne zaznaczenie węzła nie dolicza się do jego potomków', () => {
    const value = setNodeChecked('elektronika', true, emptySelection(), 'subtree', getParentId, { hasChildren: true });
    expect(below('elektronika', value)).toBe(0);
  });

  it('pokrycie poddrzewa liczy wszystkich potomków, bez samego węzła', () => {
    const value = setDescendantsSelected('elektronika', true, emptySelection(), 'subtree', getParentId);
    expect(below('elektronika', value)).toBe(4);
    expect(below('agd', value)).toBe(2);
    expect(below('pralki', value)).toBe(0);
  });

  it('wycięte poddrzewo odejmuje się od licznika przodka', () => {
    let value = setDescendantsSelected('elektronika', true, emptySelection(), 'subtree', getParentId);
    value = setDescendantsSelected('agd', false, value, 'subtree', getParentId);

    // Zostają: agd (samo, zachowane) + rtv.
    expect(below('elektronika', value)).toBe(2);
    expect(below('agd', value)).toBe(0);
  });

  it('pojedyncze zaznaczenia potomków są liczone bez pokrycia', () => {
    let value = setNodeChecked('pralki', true, emptySelection(), 'subtree', getParentId);
    value = setNodeChecked('rtv', true, value, 'subtree', getParentId);

    expect(below('elektronika', value)).toBe(2);
    expect(below('agd', value)).toBe(1);
  });

  it('nic niezaznaczone — 0 dla dowolnego węzła', () => {
    const value = emptySelection();
    expect(below('elektronika', value)).toBe(0);
    expect(below('agd', value)).toBe(0);
  });

  it('cascade none liczy zaznaczone id, których łańcuch przodków zawiera dany węzeł', () => {
    const value = { ids: ['pralki', 'rtv', 'meska'], subtreeRoots: [], excluded: [] };
    expect(resolveSelectedDescendantCount('elektronika', value, 'none', getParentId, getDescendantCount)).toBe(2);
    expect(resolveSelectedDescendantCount('agd', value, 'none', getParentId, getDescendantCount)).toBe(1);
    expect(resolveSelectedDescendantCount('odziez', value, 'none', getParentId, getDescendantCount)).toBe(1);
  });

  it('zwraca null, gdy descendantCount potrzebnego węzła jest nieznany', () => {
    const value = setDescendantsSelected('elektronika', true, emptySelection(), 'subtree', getParentId);
    expect(resolveSelectedDescendantCount('elektronika', value, 'subtree', getParentId, () => undefined)).toBeNull();
  });
});
