import { ErpInputBase } from '../../base/erp-input-base';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpInputSize } from '../erp-input/erp-input.types';
import {
  ErpTreeCascadeMode,
  ErpTreeChildrenQuery,
  ErpTreeMode,
  ErpTreeNodeAdapters,
  ErpTreeSearchQuery,
  ErpTreeSelectionValue,
} from '../../atoms/erp-tree';

export type ErpTreePickerStrategy = 'single' | 'multi';

export interface ErpTreePickerConfig<T = any> extends ErpInputBase {
  mode: MaybeSignal<ErpTreeMode>;
  adapters: ErpTreeNodeAdapters<T>;

  /** Tryb client: płaska lista wszystkich węzłów. */
  items?: MaybeSignal<readonly T[]>;
  /** Tryb server: dociąganie dzieci na żądanie. */
  loadChildrenFn?: (query: ErpTreeChildrenQuery) => any;
  /** Tryb server: wyszukiwanie zwracające dopasowania + przodków. */
  searchFn?: (query: ErpTreeSearchQuery) => any;

  strategy?: MaybeSignal<ErpTreePickerStrategy>;
  cascade?: MaybeSignal<ErpTreeCascadeMode>;
  allowDescendantsOnly?: MaybeSignal<boolean>;

  label?: MaybeSignal<Translatable | undefined>;
  value?: MaybeSignal<ErpTreeSelectionValue | undefined>;
  searchPlaceholder?: MaybeSignal<Translatable | undefined>;
  emptyContent?: MaybeSignal<Translatable | undefined>;
  size?: MaybeSignal<ErpInputSize>;

  /** Powyżej tej liczby znaczników pole pokazuje "Zaznaczone (N)" zamiast wypisanych nazw. */
  maxCollapseCount?: MaybeSignal<number>;
  pageSize?: MaybeSignal<number>;
  estimatedRowHeight?: MaybeSignal<number>;
  indentSize?: MaybeSignal<number>;
}
