import { ErpInputBaseBuilder } from '../../base/erp-input-base';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpDatePickerConfig, ErpDatePickerStrategy, ErpDatePickerMode } from './erp-datepicker.types';

/**
 * Klasa Builder dla komponentu ErpDatePicker, udostępniająca płynne (fluent) API
 * do tworzenia konfiguracji pola wyboru daty.
 */
export class ErpDatePickerBuilder extends ErpInputBaseBuilder<ErpDatePickerConfig> {
  /**
   * Ustawia etykietę (label) wyświetlaną nad polem wyboru daty.
   * @param label Tekst etykiety lub obiekt translatowalny.
   */
  public setLabel(label: MaybeSignal<Translatable | undefined>): this {
    this._data.label = label;
    return this;
  }

  /**
   * Ustawia rozmiar pola (rozmiary Taiga UI: 's', 'm', 'l').
   * @param size Wybrany rozmiar pola.
   */
  public setSize(size: MaybeSignal<'s' | 'm' | 'l'>): this {
    this._data.size = size;
    return this;
  }

  /**
   * Określa strategię wyboru daty ('single' - pojedyncza data, 'multiple' - wiele dat jako chipy, 'range' - zakres dat).
   * @param strategy Wybrana strategia wyboru.
   */
  public setStrategy(strategy: MaybeSignal<ErpDatePickerStrategy>): this {
    this._data.strategy = strategy;
    return this;
  }

  /**
   * Określa tryb wyboru ('date' - tylko data, 'datetime' - data wraz z czasem).
   * @param mode Wybrany tryb.
   */
  public setMode(mode: MaybeSignal<ErpDatePickerMode>): this {
    this._data.mode = mode;
    return this;
  }

  /**
   * Ustawia wartość początkową/aktualną dla pola daty.
   * @param value Wartość daty (typ dopasowany do wybranej strategii i trybu).
   */
  public setValue(value: MaybeSignal<any>): this {
    this._data.value = value;
    return this;
  }
}
