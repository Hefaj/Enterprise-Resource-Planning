import { ErpInputBase } from '../../base/erp-input-base';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';
import { ErpTreeCascadeMode, ErpTreeSelectionValue } from './erp-tree-selection.model';

export type ErpTreeMode = 'client' | 'server';
export type ErpTreeSelectionMode = 'none' | 'single' | 'multi';

export type { ErpTreeCascadeMode, ErpTreeSelectionValue, ErpTreeNodeCheckState } from './erp-tree-selection.model';

/**
 * Adaptery mapujące dowolny typ węzła `T` (np. `CategoryDto`) na to, czego potrzebuje drzewo.
 * `hasChildren`/`childCount` MUSZĄ przyjść z backendu w trybie server — bez nich nie da się
 * poprawnie narysować chevronu ani stanu 'indeterminate' bez pobierania dzieci.
 */
export interface ErpTreeNodeAdapters<T = any> {
  getId: (item: T) => string;
  getParentId: (item: T) => string | null | undefined;
  getLabel: (item: T) => Translatable;
  hasChildren?: (item: T) => boolean;
  childCount?: (item: T) => number | undefined;
  descendantCount?: (item: T) => number | undefined;
  getIcon?: (item: T) => ErpIcon | undefined;
  isDisabled?: (item: T) => boolean;
  isSelectable?: (item: T) => boolean;
}

export interface ErpTreeChildrenQuery {
  /** `null` = korzenie drzewa. */
  parentId: string | null;
  pageIndex: number;
  pageSize: number;
}

export interface ErpTreeChildrenResult<T = any> {
  nodes: T[];
  totalCount: number;
}

export interface ErpTreeSearchQuery {
  search: string;
}

export interface ErpTreeSearchResult<T = any> {
  /** Węzły dopasowane do frazy. */
  matches: T[];
  /** Węzły-przodkowie dopasowań — potrzebne, by zbudować kontekst hierarchii wyniku. */
  ancestors: T[];
  totalCount: number;
}

export interface ErpTreeSelectionState<T = any> {
  mode: ErpTreeMode;
  cascade: ErpTreeCascadeMode;
  value: ErpTreeSelectionValue;
  /** Materializacja do płaskiej listy uuid — tylko tryb client. */
  resolvedIds?: string[];
  /** Węzły-znaczniki, które są aktualnie znane komponentowi (do chipsów/etykiet). */
  markedItems: T[];
  marksCount: number;
}

export interface ErpTreeConfig<T = any> extends ErpInputBase {
  mode: MaybeSignal<ErpTreeMode>;
  adapters: ErpTreeNodeAdapters<T>;

  /** Tryb client: płaska lista wszystkich węzłów — komponent sam buduje hierarchię. */
  items?: MaybeSignal<readonly T[]>;

  /** Tryb server: dociąganie dzieci na żądanie (rozwinięcie węzła / scroll / kolejna strona). */
  loadChildrenFn?: (query: ErpTreeChildrenQuery) => any;
  /** Tryb server: wyszukiwanie zwracające dopasowania + ich przodków. */
  searchFn?: (query: ErpTreeSearchQuery) => any;

  selectionMode?: MaybeSignal<ErpTreeSelectionMode>;
  /** 'subtree' = zaznaczenie rodzica kaskaduje na dzieci; 'none' = węzły niezależne. */
  cascade?: MaybeSignal<ErpTreeCascadeMode>;
  /** Multi + cascade='subtree': pozwala zaznaczyć dzieci węzła bez samego węzła. */
  allowDescendantsOnly?: MaybeSignal<boolean>;
  value?: MaybeSignal<ErpTreeSelectionValue | undefined>;

  enableVirtualScroll?: MaybeSignal<boolean>;
  estimatedRowHeight?: MaybeSignal<number>;
  indentSize?: MaybeSignal<number>;
  defaultExpandedIds?: MaybeSignal<string[]>;
  showSearch?: MaybeSignal<boolean>;
  searchPlaceholder?: MaybeSignal<Translatable | undefined>;
  emptyMessage?: MaybeSignal<Translatable>;
  /** Rozmiar strony przy dociąganiu rodzeństwa (tryb server, domyślnie 50). */
  pageSize?: MaybeSignal<number>;

  onSelectionChange?: (state: ErpTreeSelectionState<T>) => void;
  onExpandedChange?: (ids: string[]) => void;
  onNodeClick?: (item: T) => void;
}

export type ErpTreeFlatRow<T = any> =
  | {
      kind: 'node';
      id: string;
      item: T;
      level: number;
      hasChildren: boolean;
      expanded: boolean;
      loading: boolean;
    }
  | { kind: 'load-more'; parentId: string | null; level: number; loading: boolean }
  | { kind: 'skeleton'; parentId: string | null; level: number };
