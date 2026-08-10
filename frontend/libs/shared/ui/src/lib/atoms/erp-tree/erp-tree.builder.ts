import { ErpInputBaseBuilder } from '../../base/erp-input-base';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import {
  ErpTreeChildrenQuery,
  ErpTreeConfig,
  ErpTreeMode,
  ErpTreeNodeAdapters,
  ErpTreeSearchQuery,
  ErpTreeSelectionMode,
  ErpTreeSelectionState,
} from './erp-tree.types';
import { ErpTreeCascadeMode, ErpTreeSelectionValue } from './erp-tree-selection.model';

/**
 * Builder dla `erp-tree` — atomu do wyświetlania danych o strukturze drzewa (np. kategorii).
 * Wzorem `ErpTableBuilder`/`ErpInputPickerBuilder`: fluent API + `create()`.
 */
export class ErpTreeBuilder<T = any> extends ErpInputBaseBuilder<ErpTreeConfig<T>> {
  public setMode(mode: MaybeSignal<ErpTreeMode>): this {
    this._data.mode = mode;
    return this;
  }

  public setAdapters(adapters: ErpTreeNodeAdapters<T>): this {
    this._data.adapters = adapters;
    return this;
  }

  public setItems(items: MaybeSignal<readonly T[]>): this {
    this._data.items = items;
    return this;
  }

  public setLoadChildrenFn(fn: (query: ErpTreeChildrenQuery) => any): this {
    this._data.loadChildrenFn = fn;
    return this;
  }

  public setSearchFn(fn: (query: ErpTreeSearchQuery) => any): this {
    this._data.searchFn = fn;
    return this;
  }

  public setSelectionMode(mode: MaybeSignal<ErpTreeSelectionMode>): this {
    this._data.selectionMode = mode;
    return this;
  }

  public setCascade(cascade: MaybeSignal<ErpTreeCascadeMode>): this {
    this._data.cascade = cascade;
    return this;
  }

  public setAllowDescendantsOnly(allow: MaybeSignal<boolean>): this {
    this._data.allowDescendantsOnly = allow;
    return this;
  }

  public setValue(value: MaybeSignal<ErpTreeSelectionValue | undefined>): this {
    this._data.value = value;
    return this;
  }

  public setEnableVirtualScroll(enable: MaybeSignal<boolean> = true): this {
    this._data.enableVirtualScroll = enable;
    return this;
  }

  public setEstimatedRowHeight(height: MaybeSignal<number>): this {
    this._data.estimatedRowHeight = height;
    return this;
  }

  public setIndentSize(size: MaybeSignal<number>): this {
    this._data.indentSize = size;
    return this;
  }

  public setDefaultExpandedIds(ids: MaybeSignal<string[]>): this {
    this._data.defaultExpandedIds = ids;
    return this;
  }

  public setShowSearch(show: MaybeSignal<boolean> = true): this {
    this._data.showSearch = show;
    return this;
  }

  public setSearchPlaceholder(placeholder: MaybeSignal<Translatable | undefined>): this {
    this._data.searchPlaceholder = placeholder;
    return this;
  }

  public setEmptyMessage(message: MaybeSignal<Translatable>): this {
    this._data.emptyMessage = message;
    return this;
  }

  public setPageSize(size: MaybeSignal<number>): this {
    this._data.pageSize = size;
    return this;
  }

  public setOnSelectionChange(fn: (state: ErpTreeSelectionState<T>) => void): this {
    this._data.onSelectionChange = fn;
    return this;
  }

  public setOnExpandedChange(fn: (ids: string[]) => void): this {
    this._data.onExpandedChange = fn;
    return this;
  }

  public setOnNodeClick(fn: (item: T) => void): this {
    this._data.onNodeClick = fn;
    return this;
  }
}
