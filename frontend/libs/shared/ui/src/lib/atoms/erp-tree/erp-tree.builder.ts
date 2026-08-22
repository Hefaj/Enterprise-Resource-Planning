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
  /**
   * Ustawia tryb działania drzewa (np. read-only, selection).
   */
  public setMode(mode: MaybeSignal<ErpTreeMode>): this {
    this._data.mode = mode;
    return this;
  }

  /**
   * Ustawia adaptery potrzebne do mapowania danych na węzły drzewa.
   */
  public setAdapters(adapters: ErpTreeNodeAdapters<T>): this {
    this._data.adapters = adapters;
    return this;
  }

  /**
   * Ustawia statyczną listę elementów (węzłów) w drzewie.
   */
  public setItems(items: MaybeSignal<readonly T[]>): this {
    this._data.items = items;
    return this;
  }

  /**
   * Ustawia funkcję do asynchronicznego pobierania dzieci dla danego węzła.
   */
  public setLoadChildrenFn(fn: (query: ErpTreeChildrenQuery) => any): this {
    this._data.loadChildrenFn = fn;
    return this;
  }

  /**
   * Ustawia funkcję do wyszukiwania elementów w drzewie na podstawie zapytania.
   */
  public setSearchFn(fn: (query: ErpTreeSearchQuery) => any): this {
    this._data.searchFn = fn;
    return this;
  }

  /**
   * Ustawia tryb zaznaczania (np. single, multi).
   */
  public setSelectionMode(mode: MaybeSignal<ErpTreeSelectionMode>): this {
    this._data.selectionMode = mode;
    return this;
  }

  /**
   * Sposób zapisu zaznaczenia potomków: 'subtree' — pokrycie poddrzewa (deskryptor
   * `subtreeRoots`/`excluded`, skaluje się bez wypisywania potomków), 'none' — wyłącznie płaska
   * lista `ids`. Klik w checkbox w OBU trybach zaznacza tylko sam węzeł, nigdy potomków.
   */
  public setCascade(cascade: MaybeSignal<ErpTreeCascadeMode>): this {
    this._data.cascade = cascade;
    return this;
  }

  /**
   * Multi + cascade='subtree': pokazuje przy checkboxie przycisk zaznaczający całe poddrzewo
   * węzła (a gdy jest już w całości zaznaczone — odznaczający je), bez zmiany stanu samego węzła.
   */
  public setAllowDescendantsOnly(allow: MaybeSignal<boolean>): this {
    this._data.allowDescendantsOnly = allow;
    return this;
  }

  /**
   * Ustawia wybraną wartość (lub wartości) w drzewie.
   */
  public setValue(value: MaybeSignal<ErpTreeSelectionValue | undefined>): this {
    this._data.value = value;
    return this;
  }

  /**
   * Włącza lub wyłącza wirtualne przewijanie dla dużych zbiorów danych.
   */
  public setEnableVirtualScroll(enable: MaybeSignal<boolean> = true): this {
    this._data.enableVirtualScroll = enable;
    return this;
  }

  /**
   * Ustawia szacowaną wysokość wiersza, używaną przy wirtualnym przewijaniu.
   */
  public setEstimatedRowHeight(height: MaybeSignal<number>): this {
    this._data.estimatedRowHeight = height;
    return this;
  }

  /**
   * Ustawia rozmiar wcięcia dla kolejnych poziomów w drzewie.
   */
  public setIndentSize(size: MaybeSignal<number>): this {
    this._data.indentSize = size;
    return this;
  }

  /**
   * Ustawia identyfikatory węzłów, które mają być domyślnie rozwinięte.
   */
  public setDefaultExpandedIds(ids: MaybeSignal<string[]>): this {
    this._data.defaultExpandedIds = ids;
    return this;
  }

  /**
   * Włącza lub wyłącza widoczność pola wyszukiwania.
   */
  public setShowSearch(show: MaybeSignal<boolean> = true): this {
    this._data.showSearch = show;
    return this;
  }

  /**
   * Ustawia tekst zastępczy (placeholder) dla pola wyszukiwania.
   */
  public setSearchPlaceholder(placeholder: MaybeSignal<Translatable | undefined>): this {
    this._data.searchPlaceholder = placeholder;
    return this;
  }

  /**
   * Ustawia wiadomość wyświetlaną, gdy drzewo nie zawiera żadnych elementów.
   */
  public setEmptyMessage(message: MaybeSignal<Translatable>): this {
    this._data.emptyMessage = message;
    return this;
  }

  /**
   * Ustawia rozmiar strony do stronicowania danych w drzewie.
   */
  public setPageSize(size: MaybeSignal<number>): this {
    this._data.pageSize = size;
    return this;
  }

  /**
   * Ustawia funkcję zwrotną (callback) wywoływaną przy zmianie zaznaczenia.
   */
  public setOnSelectionChange(fn: (state: ErpTreeSelectionState<T>) => void): this {
    this._data.onSelectionChange = fn;
    return this;
  }

  /**
   * Ustawia funkcję zwrotną (callback) wywoływaną przy zmianie rozwiniętych węzłów.
   */
  public setOnExpandedChange(fn: (ids: string[]) => void): this {
    this._data.onExpandedChange = fn;
    return this;
  }

  /**
   * Ustawia funkcję zwrotną (callback) wywoływaną po kliknięciu na węzeł.
   */
  public setOnNodeClick(fn: (item: T) => void): this {
    this._data.onNodeClick = fn;
    return this;
  }
}
