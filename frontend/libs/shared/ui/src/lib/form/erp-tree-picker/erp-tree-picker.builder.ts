import { ErpInputBaseBuilder } from '../../base/erp-input-base';
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
import { ErpTreePickerConfig, ErpTreePickerStrategy } from './erp-tree-picker.types';

/**
 * Builder dla `erp-tree-picker` — pola formularza opartego o `erp-tree`, do użycia
 * w filtrach (np. wybór kategorii z drzewa). Wzorem `ErpInputPickerBuilder`.
 */
export class ErpTreePickerBuilder<T = any> extends ErpInputBaseBuilder<ErpTreePickerConfig<T>> {
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

  public setStrategy(strategy: MaybeSignal<ErpTreePickerStrategy>): this {
    this._data.strategy = strategy;
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

  public setLabel(label: MaybeSignal<Translatable | undefined>): this {
    this._data.label = label;
    return this;
  }

  public setValue(value: MaybeSignal<ErpTreeSelectionValue | undefined>): this {
    this._data.value = value;
    return this;
  }

  public setSearchPlaceholder(placeholder: MaybeSignal<Translatable | undefined>): this {
    this._data.searchPlaceholder = placeholder;
    return this;
  }

  public setEmptyContent(content: MaybeSignal<Translatable | undefined>): this {
    this._data.emptyContent = content;
    return this;
  }

  public setSize(size: MaybeSignal<ErpInputSize>): this {
    this._data.size = size;
    return this;
  }

  public setMaxCollapseCount(count: MaybeSignal<number>): this {
    this._data.maxCollapseCount = count;
    return this;
  }

  public setPageSize(size: MaybeSignal<number>): this {
    this._data.pageSize = size;
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
}
