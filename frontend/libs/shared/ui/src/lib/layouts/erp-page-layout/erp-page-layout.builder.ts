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
}
