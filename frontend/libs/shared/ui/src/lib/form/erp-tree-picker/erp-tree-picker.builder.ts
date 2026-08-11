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
  /**
   * Ustawia tryb działania picker'a drzewa (np. read-only, selection).
   */
  public setMode(mode: MaybeSignal<ErpTreeMode>): this {
    this._data.mode = mode;
    return this;
  }

  /**
   * Ustawia adaptery potrzebne do mapowania danych na węzły drzewa w pickerze.
   */
  public setAdapters(adapters: ErpTreeNodeAdapters<T>): this {
    this._data.adapters = adapters;
    return this;
  }

  /**
   * Ustawia statyczną listę elementów (węzłów) dla drzewa wewnątrz picker'a.
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
   * Ustawia funkcję do wyszukiwania elementów na podstawie zapytania tekstowego.
   */
  public setSearchFn(fn: (query: ErpTreeSearchQuery) => any): this {
    this._data.searchFn = fn;
    return this;
  }

  /**
   * Ustawia strategię picker'a (np. 'tags'), określającą sposób wyświetlania wybranych elementów.
   */
  public setStrategy(strategy: MaybeSignal<ErpTreePickerStrategy>): this {
    this._data.strategy = strategy;
    return this;
  }

  /**
   * Ustawia tryb kaskadowy podczas zaznaczania elementów (np. strict, down).
   */
  public setCascade(cascade: MaybeSignal<ErpTreeCascadeMode>): this {
    this._data.cascade = cascade;
    return this;
  }

  /**
   * Ustawia, czy dozwolone jest zaznaczanie tylko węzłów-dzieci (liści).
   */
  public setAllowDescendantsOnly(allow: MaybeSignal<boolean>): this {
    this._data.allowDescendantsOnly = allow;
    return this;
  }

  /**
   * Ustawia etykietę wyświetlaną dla pola picker'a.
   */
  public setLabel(label: MaybeSignal<Translatable | undefined>): this {
    this._data.label = label;
    return this;
  }

  /**
   * Ustawia wybraną wartość (lub wartości) w pickerze.
   */
  public setValue(value: MaybeSignal<ErpTreeSelectionValue | undefined>): this {
    this._data.value = value;
    return this;
  }

  /**
   * Ustawia tekst zastępczy (placeholder) dla wewnętrznego pola wyszukiwania.
   */
  public setSearchPlaceholder(placeholder: MaybeSignal<Translatable | undefined>): this {
    this._data.searchPlaceholder = placeholder;
    return this;
  }

  /**
   * Ustawia treść wyświetlaną, gdy picker jest pusty i nie ma wyników.
   */
  public setEmptyContent(content: MaybeSignal<Translatable | undefined>): this {
    this._data.emptyContent = content;
    return this;
  }

  /**
   * Ustawia rozmiar wizualny picker'a (np. m, l).
   */
  public setSize(size: MaybeSignal<ErpInputSize>): this {
    this._data.size = size;
    return this;
  }

  /**
   * Ustawia maksymalną liczbę wybranych elementów wyświetlanych jako chipy przed ich zwinięciem.
   */
  public setMaxCollapseCount(count: MaybeSignal<number>): this {
    this._data.maxCollapseCount = count;
    return this;
  }

  /**
   * Ustawia rozmiar strony używany do ładowania danych/stronicowania.
   */
  public setPageSize(size: MaybeSignal<number>): this {
    this._data.pageSize = size;
    return this;
  }

  /**
   * Ustawia szacowaną wysokość wiersza, wymaganą dla wirtualnego przewijania opcji.
   */
  public setEstimatedRowHeight(height: MaybeSignal<number>): this {
    this._data.estimatedRowHeight = height;
    return this;
  }

  /**
   * Ustawia rozmiar wcięcia poziomu dla poszczególnych węzłów na liście opcji.
   */
  public setIndentSize(size: MaybeSignal<number>): this {
    this._data.indentSize = size;
    return this;
  }
}
