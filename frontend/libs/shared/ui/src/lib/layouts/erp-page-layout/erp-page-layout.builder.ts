import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal } from '../../base/erp-signal-utils';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';
import { ErpPageLayoutConfig } from './erp-page-layout.types';

/**
 * Klasa Builder dla komponentu ErpPageLayout, dostarczająca interfejs fluent API
 * do konfiguracji layoutu strony (sidebar z filtrami + main content).
 *
 * @example
 * ```ts
 * protected readonly pageConfig = ErpPageLayoutBuilder.create((b) =>
 *   b
 *     .setLeftSidebar(ProductFilterComponent)
 *     .setMain(ErpTabsComponent, { config: this.tabsConfig })
 * );
 * ```
 */
export class ErpPageLayoutBuilder extends ErpBaseBuilder<ErpPageLayoutConfig> {
  /**
   * Ustawia komponent wyświetlany w lewym sidebarze (np. panel filtrów).
   * Drugi opcjonalny parametr pozwala przekazać silnie typowane wartości Inputów komponentu.
   */
  public setLeftSidebar<TComponent>(
    component: Type<TComponent>,
    inputs?: ErpComponentSignalInputs<TComponent>
  ): this {
    this._data.leftSidebar = { component, inputs };
    return this;
  }

  /**
   * Ustawia komponent wyświetlany w głównej sekcji strony.
   * Drugi opcjonalny parametr pozwala przekazać silnie typowane wartości Inputów komponentu.
   */
  public setMain<TComponent>(
    component: Type<TComponent>,
    inputs?: ErpComponentSignalInputs<TComponent>
  ): this {
    this._data.main = { component, inputs };
    return this;
  }

  /**
   * Ustawia szerokość lewego sidebara w pikselach (domyślnie 280px).
   */
  public setSidebarWidth(width: MaybeSignal<number>): this {
    this._data.sidebarWidth = width;
    return this;
  }

  /**
   * Kontroluje stan zwinięcia sidebara.
   * Gdy true — sidebar jest ukryty, a sekcja main zajmuje 100% szerokości.
   */
  public setSidebarCollapsed(collapsed: MaybeSignal<boolean>): this {
    this._data.sidebarCollapsed = collapsed;
    return this;
  }

  /**
   * Ustawia tryb działania sidebara: 'push' (rozpycha zawartość) lub 'overlay' (nadchodzi na nią).
   */
  public setSidebarMode(mode: MaybeSignal<'push' | 'overlay'>): this {
    this._data.sidebarMode = mode;
    return this;
  }

  /**
   * Zezwala lub blokuje użytkownikowi zmianę szerokości lewego sidebara (domyślnie true).
   */
  public setLeftSidebarResizable(resizable: MaybeSignal<boolean>): this {
    this._data.leftSidebarResizable = resizable;
    return this;
  }

  /**
   * Ustawia minimalną szerokość lewego sidebara w px (domyślnie 100).
   */
  public setLeftSidebarMinWidth(width: MaybeSignal<number>): this {
    this._data.leftSidebarMinWidth = width;
    return this;
  }

  /**
   * Ustawia maksymalną szerokość lewego sidebara w px (domyślnie 800).
   */
  public setLeftSidebarMaxWidth(width: MaybeSignal<number>): this {
    this._data.leftSidebarMaxWidth = width;
    return this;
  }

  /**
   * Ustawia komponent wyświetlany w prawym sidebarze.
   */
  public setRightSidebar<TComponent>(
    component: Type<TComponent>,
    inputs?: ErpComponentSignalInputs<TComponent>
  ): this {
    this._data.rightSidebar = { component, inputs };
    return this;
  }

  /**
   * Ustawia szerokość prawego sidebara w pikselach (domyślnie 280px).
   */
  public setRightSidebarWidth(width: MaybeSignal<number>): this {
    this._data.rightSidebarWidth = width;
    return this;
  }

  /**
   * Kontroluje stan zwinięcia prawego sidebara.
   */
  public setRightSidebarCollapsed(collapsed: MaybeSignal<boolean>): this {
    this._data.rightSidebarCollapsed = collapsed;
    return this;
  }

  /**
   * Ustawia tryb działania prawego sidebara: 'push' lub 'overlay'.
   */
  public setRightSidebarMode(mode: MaybeSignal<'push' | 'overlay'>): this {
    this._data.rightSidebarMode = mode;
    return this;
  }

  /**
   * Zezwala lub blokuje użytkownikowi zmianę szerokości prawego sidebara (domyślnie true).
   */
  public setRightSidebarResizable(resizable: MaybeSignal<boolean>): this {
    this._data.rightSidebarResizable = resizable;
    return this;
  }

  /**
   * Ustawia minimalną szerokość prawego sidebara w px (domyślnie 100).
   */
  public setRightSidebarMinWidth(width: MaybeSignal<number>): this {
    this._data.rightSidebarMinWidth = width;
    return this;
  }

  /**
   * Ustawia maksymalną szerokość prawego sidebara w px (domyślnie 800).
   */
  public setRightSidebarMaxWidth(width: MaybeSignal<number>): this {
    this._data.rightSidebarMaxWidth = width;
    return this;
  }

  /**
   * Ustawia ID layoutu używane do odczytu i zapisu ustawień (np. szerokości).
   */
  public setLayoutId(id: string): this {
    this._data.layoutId = id;
    return this;
  }
}
