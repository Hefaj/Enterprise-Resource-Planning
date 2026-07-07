import { ErpInputBaseBuilder } from '../../base/erp-input-base';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';
import { ErpInputConfig, ErpInputSize, ErpInputType } from './erp-input.types';

/**
 * Klasa Builder dla komponentu ErpInput, udostępniająca płynne (fluent) API
 * do tworzenia konfiguracji pola wejściowego.
 */
export class ErpInputBuilder extends ErpInputBaseBuilder<ErpInputConfig> {
  /**
   * Ustawia stan wyłączenia (disabled) pola wejściowego.
   * @param disabled Statyczna wartość logiczna lub sygnał (Signal).
   */
  public setDisabled(disabled: MaybeSignal<boolean>): this {
    this._data.disabled = disabled;
    return this;
  }

  /**
   * Konfiguruje podpowiedź (tooltip) wyświetlaną na ikonie pomocy pola.
   * @param tooltip Tekst podpowiedzi lub klucz tłumaczenia.
   */
  public setTooltip(tooltip: MaybeSignal<Translatable | undefined>): this {
    this._data.tooltip = tooltip;
    return this;
  }

  /**
   * Ustawia ikonę początkową (wyświetlaną po lewej stronie).
   * @param icon Wybrana ikona z definicji ERP_ICONS.
   */
  public setIconStart(icon: MaybeSignal<ErpIcon | undefined>): this {
    this._data.iconStart = icon;
    return this;
  }

  /**
   * Ustawia ikonę końcową (wyświetlaną po prawej stronie).
   * @param icon Wybrana ikona z definicji ERP_ICONS.
   */
  public setIconEnd(icon: MaybeSignal<ErpIcon | undefined>): this {
    this._data.iconEnd = icon;
    return this;
  }

  /**
   * Ustawia rozmiar pola (s, m lub l).
   * @param size Dostępne rozmiary: 's', 'm' lub 'l'.
   */
  public setSize(size: MaybeSignal<ErpInputSize>): this {
    this._data.size = size;
    return this;
  }


  /**
   * Ustawia typ HTML pola input (np. text, password, email).
   * @param type Typ wejścia HTML.
   */
  public setType(type: MaybeSignal<ErpInputType>): this {
    this._data.type = type;
    return this;
  }

  /**
   * Ustawia domyślną/inicjalną wartość tekstową pola.
   * @param value Wartość tekstowa lub sygnał.
   */
  public setValue(value: MaybeSignal<string>): this {
    this._data.value = value;
    return this;
  }

  /**
   * Ustawia pływającą etykietę (floating label) pola wejściowego.
   * @param label Tekst etykiety lub klucz tłumaczenia.
   */
  public setLabel(label: MaybeSignal<Translatable | undefined>): this {
    this._data.label = label;
    return this;
  }

  /**
   * Powiązuje pole wejściowe ze strukturą formularza opartą o sygnały (Signal Forms).
   * @param formField Obiekt pola z drzewa formularza (FieldTree).
   */
  public setFormField(formField: MaybeSignal<any>): this {
    this._data.formField = formField;
    return this;
  }
}
