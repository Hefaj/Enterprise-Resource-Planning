import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';
import { ErpIcon } from '../../base/erp-icon.types';
import { ErpTabItem, ErpTabsConfig } from './erp-tabs.types';

/**
 * Klasa Builder dla komponentu ErpTabs, dostarczająca interfejs fluent API
 * do konfiguracji zakładek z dynamicznymi komponentami.
 *
 * @example
 * ```ts
 * protected readonly tabsConfig = ErpTabsBuilder.create((b) =>
 *   b
 *     .addTab(PRODUCT_KEYS.base.tabs.products, 'products', {
 *       component: ProductTabComponent,
 *       icon: '@tui.shopping-bag',
 *     })
 *     .addTab(PRODUCT_KEYS.base.tabs.multimedia, 'multimedia', {
 *       component: MultimediaTabComponent,
 *       icon: '@tui.image',
 *       closable: true,
 *     })
 *     .setInitialValue('products')
 *     .setOnTabChange((id) => console.log('Active tab:', id))
 *     .setOnTabClose((id) => console.log('Closed tab:', id))
 * );
 * ```
 */
export class ErpTabsBuilder extends ErpBaseBuilder<ErpTabsConfig> {
  constructor() {
    super();
    this._data.tabs = [];
  }

  /**
   * Dodaje nową zakładkę do konfiguracji.
   *
   * @param label Klucz tłumaczenia lub tekst zakładki.
   * @param id Unikalny identyfikator zakładki.
   * @param options Opcjonalna konfiguracja (komponent, ikona, closable, disabled).
   */
  public addTab<TComponent>(
    label: Translatable,
    id: string,
    options?: {
      component?: Type<TComponent>;
      inputs?: ErpComponentSignalInputs<TComponent>;
      icon?: ErpIcon;
      closable?: boolean;
      disabled?: boolean;
      children?: ErpTabItem[];
    }
  ): this {
    const tab: ErpTabItem<TComponent> = {
      label,
      id,
      ...options,
    };
    this._data.tabs!.push(tab);
    return this;
  }

  /**
   * Ustawia początkową aktywną zakładkę po identyfikatorze.
   */
  public setInitialValue(tabId: string): this {
    this._data.initialValue = tabId;
    return this;
  }

  /**
   * Ustawia callback wywoływany po zmianie aktywnej zakładki.
   */
  public setOnTabChange(fn: (tabId: string) => void): this {
    this._data.onTabChange = fn;
    return this;
  }

  /**
   * Ustawia callback wywoływany przy zamykaniu zakładki.
   * Wspiera funkcje asynchroniczne (Promise).
   */
  public setOnTabClose(fn: (tabId: string) => void | Promise<void>): this {
    this._data.onTabClose = fn;
    return this;
  }

  /**
   * Ustawia rozmiar zakładek ('m' | 'l').
   */
  public setSize(size: MaybeSignal<'m' | 'l'>): this {
    this._data.size = size;
    return this;
  }

  /**
   * Kontroluje wyświetlanie podkreślenia aktywnej zakładki.
   */
  public setUnderline(underline: MaybeSignal<boolean>): this {
    this._data.underline = underline;
    return this;
  }
}
