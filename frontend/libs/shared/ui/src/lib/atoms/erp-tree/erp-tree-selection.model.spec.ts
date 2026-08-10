import { describe, expect, it } from 'vitest';
import {
  buildMarksBelowIndex,
  buildParentIndex,
  emptySelection,
  getNodeState,
  isNodeIncluded,
  normalize,
  parentResolverFromIndex,
  resolveCheckedIds,
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

    const marksBelow = buildMarksBelowIndex(value, 'subtree', getParentId);
    expect(getNodeState('agd', value, 'subtree', getParentId, marksBelow)).toBe('unchecked');
    expect(getNodeState('pralki', value, 'subtree', getParentId, marksBelow)).toBe('checked');
  });

  it('ponowne zaznaczenie wcześniej wykluczonego dziecka czyści wyjątek (normalize usuwa martwy excluded)', () => {
    let value = emptySelection();
    value = setNodeChecked('agd', true, value, 'subtree', getParentId);
    value = setNodeChecked('pralki', false, value, 'subtree', getParentId);
    value = setNodeChecked('pralki', true, value, 'subtree', getParentId);

    expect(value.excluded).toEqual([]);
    expect(value.subtreeRoots).toEqual(['agd']);
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
