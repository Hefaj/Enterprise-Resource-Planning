import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { ErpTabsConfig, ErpTabItem } from './erp-tabs.component';
import { Type } from '@angular/core';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';

export class ErpTabsBuilder extends ErpBaseBuilder<ErpTabsConfig> {
  constructor() {
    super();
    this._data.items = [];
  }

  /**
   * Dodaje zakładkę. Opcjonalnie przypisuje komponent renderowany po wybraniu.
   * @param label — Tekst wyświetlany na zakładce
   * @param value — Unikalna wartość identyfikująca zakładkę
   * @param component — Komponent Angular wstrzykiwany jako treść zakładki
   * @param config — Konfiguracja (inputy) przekazywana do komponentu
   * @param options — Opcje dodatkowe: ikona, wyłączenie zakładki
   */
  public addItem<TComp>(
    label: string, 
    value: string | number, 
    component?: Type<TComp>, 
    config?: ErpComponentSignalInputs<TComp> | any,
    options: { icon?: string, disabled?: boolean } = {}
  ): this {
    this._data.items?.push({ 
      label, 
      value, 
      icon: options.icon, 
      disabled: options.disabled,
      component,
      config: this._extract(config)
    });
    return this;
  }

  /** Ustawia zakładkę aktywną na starcie. */
  public setInitialValue(value: string | number): this {
    this._data.initialValue = value;
    return this;
  }

  /** Callback wywoływany przy każdej zmianie aktywnej zakładki. */
  public onTabChange(callback: (value: string | number) => void): this {
    this._data.onTabChange = callback;
    return this;
  }

  /** Tryb 'headless' — renderuje tylko listę zakładek, bez obszaru treści. */
  public setHeadless(headless = true): this {
    this._data.headless = headless;
    return this;
  }

  /** Ustawia zakładki z gotowej tablicy (zastępuje addItem). */
  public setItems(items: ErpTabItem[]): this {
    this._data.items = items;
    return this;
  }
}
