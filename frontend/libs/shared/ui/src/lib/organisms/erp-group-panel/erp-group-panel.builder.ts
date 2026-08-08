import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';
import { ErpActionToolbarConfig } from '../../molecules/erp-action-toolbar/erp-action-toolbar.types';
import { ErpVisibleRange } from '../../atoms/erp-scroll-viewport/erp-scroll-viewport.types';
import { ErpGroupPanelConfig } from './erp-group-panel.types';

/**
 * Klasa Builder dla komponentu ErpGroupPanel — kompozycji paska akcji
 * i wirtualizowanej listy grup ze stanami empty/overflow.
 *
 * @example
 * ```ts
 * protected readonly panelConfig = ErpGroupPanelBuilder.create<ProductVM>((b) =>
 *   b
 *     .setToolbar(this.toolbarConfig)
 *     .setItems(this._selectedProducts)
 *     .setGetItemKey((_, item) => item.uuid)
 *     .setEstimateSize(250)
 *     .setOnRangeChange((range) => this.loadVisible(range))
 *     .setEmptyState({ icon: '@tui.mouse-pointer-click', message: PRODUCT_KEYS.base.multimedia.panel.emptySelection })
 *     .setOverflow({ threshold: MAX_DETAILED_SELECTION, message: PRODUCT_KEYS.base.multimedia.panel.bulkDescription })
 * );
 * ```
 */
export class ErpGroupPanelBuilder<TItem = any> extends ErpBaseBuilder<ErpGroupPanelConfig<TItem>> {
  /** Ustawia konfigurację paska akcji. */
  public setToolbar(toolbar: ErpActionToolbarConfig): this {
    this._data.toolbar = toolbar;
    return this;
  }

  /** Ustawia listę elementów (grup) do wirtualizacji. */
  public setItems(items: MaybeSignal<TItem[]>): this {
    this._data.items = items;
    return this;
  }

  /** Ustawia funkcję zwracającą unikalny klucz dla elementu. */
  public setGetItemKey(fn: (index: number, item: TItem) => string): this {
    this._data.getItemKey = fn;
    return this;
  }

  /** Ustawia szacunkową wysokość elementu w px. */
  public setEstimateSize(size: MaybeSignal<number>): this {
    this._data.estimateSize = size;
    return this;
  }

  /** Ustawia ilość elementów pre-renderowanych poza viewport. */
  public setOverscan(overscan: MaybeSignal<number>): this {
    this._data.overscan = overscan;
    return this;
  }

  /** Ustawia callback wywoływany przy zmianie zakresu widocznych elementów. */
  public setOnRangeChange(fn: (range: ErpVisibleRange) => void): this {
    this._data.onRangeChange = fn;
    return this;
  }

  /** Ustawia margines scrollu (px) przed początkiem listy. */
  public setPaddingStart(padding: MaybeSignal<number>): this {
    this._data.paddingStart = padding;
    return this;
  }

  /** Ustawia margines scrollu (px) za końcem listy. */
  public setPaddingEnd(padding: MaybeSignal<number>): this {
    this._data.paddingEnd = padding;
    return this;
  }

  /** Ustawia komunikat stanu pustego (gdy brak elementów). */
  public setEmptyState(message: MaybeSignal<Translatable>, icon?: MaybeSignal<ErpIcon>): this {
    this._data.emptyState = { message, icon };
    return this;
  }

  /** Ustawia próg i komunikat stanu przepełnienia. */
  public setOverflow(threshold: number, message: MaybeSignal<Translatable>, icon?: MaybeSignal<ErpIcon>): this {
    this._data.overflow = { threshold, message, icon };
    return this;
  }
}
