import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal } from '../../base/erp-signal-utils';
import { ErpScrollViewportConfig, ErpVisibleRange } from './erp-scroll-viewport.types';

/**
 * Klasa Builder dla komponentu ErpScrollViewport, dostarczająca interfejs fluent API
 * do konfiguracji wirtualizowanej listy z TanStack Virtual.
 *
 * @example
 * ```ts
 * protected readonly scrollConfig = ErpScrollViewportBuilder.create<ProductVM>((b) =>
 *   b
 *     .setItems(this.selectedProducts)
 *     .setGetItemKey((i, item) => item.uuid)
 *     .setEstimateSize(250)
 *     .setOverscan(3)
 *     .setOnRangeChange((range) => this.loadDataForVisibleGroups(range))
 * );
 * ```
 */
export class ErpScrollViewportBuilder<TItem = any> extends ErpBaseBuilder<ErpScrollViewportConfig<TItem>> {
  /**
   * Ustawia listę elementów do wirtualizacji.
   */
  public setItems(items: MaybeSignal<TItem[]>): this {
    this._data.items = items;
    return this;
  }

  /**
   * Ustawia funkcję zwracającą unikalny klucz dla elementu.
   * Klucz powinien być stabilny (np. UUID) — zmiana klucza powoduje re-render.
   */
  public setGetItemKey(fn: (index: number, item: TItem) => string): this {
    this._data.getItemKey = fn;
    return this;
  }

  /**
   * Ustawia szacunkową wysokość elementu w px.
   * Lepiej przeszacować — TanStack dynamicznie skoryguje po pomiarze.
   */
  public setEstimateSize(size: MaybeSignal<number>): this {
    this._data.estimateSize = size;
    return this;
  }

  /**
   * Ustawia ilość elementów pre-renderowanych poza viewport (domyślnie 3).
   */
  public setOverscan(overscan: MaybeSignal<number>): this {
    this._data.overscan = overscan;
    return this;
  }

  /**
   * Ustawia callback wywoływany przy zmianie zakresu widocznych elementów.
   * Idealny do triggerowania lazy-load danych.
   */
  public setOnRangeChange(fn: (range: ErpVisibleRange) => void): this {
    this._data.onRangeChange = fn;
    return this;
  }

  /**
   * Ustawia margines scrollu (px) przed początkiem listy.
   */
  public setPaddingStart(padding: MaybeSignal<number>): this {
    this._data.paddingStart = padding;
    return this;
  }

  /**
   * Ustawia margines scrollu (px) za końcem listy.
   */
  public setPaddingEnd(padding: MaybeSignal<number>): this {
    this._data.paddingEnd = padding;
    return this;
  }
}
