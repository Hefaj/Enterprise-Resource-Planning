import { Type } from '@angular/core';
import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';
import { ErpDrawerConfig } from './erp-drawer.types';

/**
 * Klasa Builder dla komponentu ErpDrawer, dostarczająca interfejs fluent API
 * do wygodnego tworzenia konfiguracji bocznych szuflad (drawers).
 */
export class ErpDrawerBuilder extends ErpBaseBuilder<ErpDrawerConfig<any>> {
  /**
   * Kontroluje stan otwarcia/widoczności szuflady.
   */
  public setOpen(open: MaybeSignal<boolean>): this {
    this._data.open = open;
    return this;
  }

  /**
   * Ustawia tytuł nagłówka szuflady (wspiera tłumaczenia Transloco).
   */
  public setTitle(title: MaybeSignal<Translatable>): this {
    this._data.title = title;
    return this;
  }

  /**
   * Kontroluje czy pod szufladą ma wyświetlać się półprzezroczyste tło (overlay/backdrop).
   */
  public setOverlay(overlay: MaybeSignal<boolean>): this {
    this._data.overlay = overlay;
    return this;
  }

  /**
   * Określa kierunek otwarcia szuflady ('start' - od lewej, 'end' - od prawej).
   */
  public setDirection(direction: MaybeSignal<'start' | 'end'>): this {
    this._data.direction = direction;
    return this;
  }

  /**
   * Ustawia dynamiczny komponent do wyświetlenia wewnątrz szuflady.
   * Drugi opcjonalny parametr pozwala przekazać silnie typowane wartości dla Inputów/Modeli tego komponentu.
   */
  public setComponent<TComponent>(
    component: Type<TComponent>,
    inputs?: ErpComponentSignalInputs<TComponent>
  ): this {
    this._data.component = component;
    this._data.inputs = inputs;
    return this;
  }

  /**
   * Określa, czy szuflada powinna się automatycznie zamknąć w momencie zmiany ścieżki (nawigacji).
   */
  public setCloseOnNavigation(closeOnNavigation: MaybeSignal<boolean>): this {
    this._data.closeOnNavigation = closeOnNavigation;
    return this;
  }

  /**
   * Ustawia funkcję zwrotną (callback) wywoływaną podczas zamykania szuflady.
   */
  public setOnClose(onClose: () => void): this {
    this._data.onClose = onClose;
    return this;
  }
}
