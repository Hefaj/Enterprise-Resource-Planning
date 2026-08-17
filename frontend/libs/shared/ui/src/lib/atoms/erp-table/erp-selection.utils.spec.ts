import { describe, expect, it } from 'vitest';
import {
  erpBuildBatchTargets,
  erpResolveSelectionScope,
  erpSelectionCount,
  erpSelectionScopeCount,
} from './erp-selection.utils';
import { ErpSelectionState } from './erp-table.types';

interface TestItem {
  uuid: string;
}

interface TestFilter {
  manufacturer?: string;
}

const explicitSelection = (ids: string[]): ErpSelectionState<TestItem> => ({
  mode: 'server',
  isAllSelected: false,
  selectedIds: ids,
  selectedItems: ids.map(uuid => ({ uuid })),
});

/** „Zaznacz wszystko" w trybie serwerowym: zaznaczenie opisuje filtr, pozycji nie ma. */
const allSelected = (totalCount: number, filters: TestFilter = { manufacturer: 'ACME' }): ErpSelectionState<TestItem> => ({
  mode: 'server',
  isAllSelected: true,
  selectedIds: [],
  selectedItems: [],
  filters,
  totalCount,
});

describe('erpResolveSelectionScope', () => {
  const options = { materializeLimit: 100 };

  it('brak zaznaczenia daje zasięg pusty', () => {
    expect(erpResolveSelectionScope(null, options).kind).toBe('none');
    expect(erpResolveSelectionScope(explicitSelection([]), options).kind).toBe('none');
    // „Zaznacz wszystko" przy pustych wynikach też nie jest zaznaczeniem.
    expect(erpResolveSelectionScope(allSelected(0), options).kind).toBe('none');
  });

  it('ręczne zaznaczenie daje listę identyfikatorów', () => {
    const scope = erpResolveSelectionScope<TestItem, TestFilter>(explicitSelection(['a', 'b']), options);

    expect(scope).toMatchObject({ kind: 'explicit', ids: ['a', 'b'], count: 2, materialized: false, loading: false });
  });

  it('„Zaznacz wszystko" powyżej progu zostaje filtrem', () => {
    const scope = erpResolveSelectionScope<TestItem, TestFilter>(allSelected(1500), options);

    expect(scope).toMatchObject({ kind: 'query', count: 1500, filter: { manufacturer: 'ACME' } });
  });

  it('„Zaznacz wszystko" poniżej progu czeka na materializację, a potem jest listą', () => {
    const pending = erpResolveSelectionScope<TestItem, TestFilter>(allSelected(5), options);
    expect(pending).toMatchObject({ kind: 'explicit', ids: [], count: 5, materialized: true, loading: true });

    const resolved = erpResolveSelectionScope<TestItem, TestFilter>(allSelected(5), {
      ...options,
      materializedIds: ['a', 'b', 'c', 'd', 'e'],
    });
    expect(resolved).toMatchObject({
      kind: 'explicit',
      ids: ['a', 'b', 'c', 'd', 'e'],
      count: 5,
      materialized: true,
      loading: false,
    });
  });

  it('granica progu należy do trybu listy', () => {
    expect(erpResolveSelectionScope(allSelected(100), options).kind).toBe('explicit');
    expect(erpResolveSelectionScope(allSelected(101), options).kind).toBe('query');
  });
});

describe('erpBuildBatchTargets', () => {
  const options = { materializeLimit: 100 };

  it('zasięg listy adresuje identyfikatory', () => {
    const scope = erpResolveSelectionScope<TestItem, TestFilter>(explicitSelection(['a', 'b']), options);

    expect(erpBuildBatchTargets(scope)).toEqual({ targetUuids: ['a', 'b'] });
  });

  it('zasięg filtra adresuje filtr — bez identyfikatorów', () => {
    const scope = erpResolveSelectionScope<TestItem, TestFilter>(allSelected(1500), options);

    expect(erpBuildBatchTargets(scope)).toEqual({ targetFilter: { manufacturer: 'ACME' } });
  });

  it('zmaterializowane „Zaznacz wszystko" adresuje identyfikatory, nie filtr (WYSIWYG)', () => {
    const scope = erpResolveSelectionScope<TestItem, TestFilter>(allSelected(3), {
      ...options,
      materializedIds: ['a', 'b', 'c'],
    });

    expect(erpBuildBatchTargets(scope)).toEqual({ targetUuids: ['a', 'b', 'c'] });
  });

  it('pusty zasięg nie adresuje niczego', () => {
    expect(erpBuildBatchTargets({ kind: 'none' })).toEqual({});
  });
});

describe('liczności', () => {
  it('erpSelectionCount czyta totalCount przy „Zaznacz wszystko"', () => {
    expect(erpSelectionCount(allSelected(1500))).toBe(1500);
    expect(erpSelectionCount(explicitSelection(['a']))).toBe(1);
    expect(erpSelectionCount(null)).toBe(0);
  });

  it('erpSelectionScopeCount działa dla każdego rodzaju zasięgu', () => {
    const options = { materializeLimit: 100 };

    expect(erpSelectionScopeCount({ kind: 'none' })).toBe(0);
    expect(erpSelectionScopeCount(erpResolveSelectionScope(explicitSelection(['a', 'b']), options))).toBe(2);
    expect(erpSelectionScopeCount(erpResolveSelectionScope(allSelected(1500), options))).toBe(1500);
    // W trakcie materializacji licznik pokazuje docelową liczność, a nie zero.
    expect(erpSelectionScopeCount(erpResolveSelectionScope(allSelected(7), options))).toBe(7);
  });
});
