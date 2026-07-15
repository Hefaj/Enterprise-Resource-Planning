import { ErpInputBaseBuilder } from '../../base/erp-input-base';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpInputColorConfig, ErpInputColorSize } from './erp-input-color.types';

/**
 * Klasa Builder dla komponentu ErpInputColor, udostępniająca płynne (fluent) API
 * do tworzenia konfiguracji pola wyboru koloru.
 */
export class ErpInputColorBuilder extends ErpInputBaseBuilder<ErpInputColorConfig> {
  /**
   * Ustawia etykietę tekstową (wspiera tłumaczenia Transloco).
   */
  public setLabel(label: MaybeSignal<Translatable | undefined>): this {
    this._data.label = label;
    return this;
  }

  /**
   * Kontroluje stan zablokowania/wyłączenia pola.
   */
  public setDisabled(disabled: MaybeSignal<boolean>): this {
    this._data.disabled = disabled;
    return this;
  }

  /**
   * Ustawia podpowiedź (tooltip) dla pola.
   */
  public setTooltip(tooltip: MaybeSignal<Translatable | undefined>): this {
    this._data.tooltip = tooltip;
    return this;
  }

  /**
   * Ustawia domyślną/inicjalną wartość koloru (np. hex `#ffffff`).
   */
  public setValue(value: MaybeSignal<string>): this {
    this._data.value = value;
    return this;
  }

  /**
   * Ustawia rozmiar pola (s, m lub l).
   */
  public setSize(size: MaybeSignal<ErpInputColorSize>): this {
    this._data.size = size;
    return this;
  }
}
