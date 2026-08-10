import { ErpInputBaseBuilder } from '../../base/erp-input-base';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpBulkInputConfig } from './erp-bulk-input.types';

/**
 * Klasa Builder dla komponentu ErpBulkInput, udostępniająca płynne (fluent) API
 * do tworzenia konfiguracji pola wielowartościowego (masowe wklejanie danych).
 */
export class ErpBulkInputBuilder extends ErpInputBaseBuilder<ErpBulkInputConfig> {
  /**
   * Ustawia etykietę tekstową pola (wspiera tłumaczenia Transloco).
   */
  public setLabel(label: MaybeSignal<Translatable | undefined>): this {
    this._data.label = label;
    return this;
  }

  /**
   * Ustawia domyślną/inicjalną listę wartości.
   */
  public setValue(value: MaybeSignal<string[] | undefined>): this {
    this._data.value = value;
    return this;
  }
}
