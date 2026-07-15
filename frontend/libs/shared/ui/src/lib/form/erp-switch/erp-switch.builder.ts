import { ErpInputBaseBuilder } from '../../base/erp-input-base';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpSwitchConfig, ErpSwitchSize } from './erp-switch.types';

/**
 * Klasa Builder dla komponentu ErpSwitch, udostępniająca płynne (fluent) API
 * do tworzenia konfiguracji pola wyboru.
 */
export class ErpSwitchBuilder extends ErpInputBaseBuilder<ErpSwitchConfig> {
  /**
   * Ustawia etykietę tekstową (wspiera tłumaczenia Transloco).
   */
  public setLabel(label: MaybeSignal<Translatable | undefined>): this {
    this._data.label = label;
    return this;
  }

  /**
   * Kontroluje stan zablokowania/wyłączenia przełącznika.
   */
  public setDisabled(disabled: MaybeSignal<boolean>): this {
    this._data.disabled = disabled;
    return this;
  }

  /**
   * Ustawia podpowiedź (tooltip) dla przełącznika.
   */
  public setTooltip(tooltip: MaybeSignal<Translatable | undefined>): this {
    this._data.tooltip = tooltip;
    return this;
  }

  /**
   * Ustawia domyślną/inicjalną wartość logiczną przełącznika.
   */
  public setValue(value: MaybeSignal<boolean>): this {
    this._data.value = value;
    return this;
  }

  /**
   * Ustawia rozmiar przełącznika (s lub m).
   */
  public setSize(size: MaybeSignal<ErpSwitchSize>): this {
    this._data.size = size;
    return this;
  }
}
