import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';
import { ErpButtonAppearance, ErpButtonConfig, ErpButtonSize } from './erp-button.types';

/**
 * Klasa Builder dla komponentu ErpButton, dostarczająca interfejs fluent API
 * do wygodnego tworzenia konfiguracji przycisków.
 */
export class ErpButtonBuilder extends ErpBaseBuilder<ErpButtonConfig> {
  /**
   * Ustawia etykietę tekstową (wspiera tłumaczenia Transloco).
   */
  public setLabel(label: MaybeSignal<Translatable>): this {
    this._data.label = label;
    return this;
  }

  /**
   * Ustawia rozmiar przycisku ('xs' | 's' | 'm' | 'l').
   */
  public setSize(size: MaybeSignal<ErpButtonSize>): this {
    this._data.size = size;
    return this;
  }

  /**
   * Ustawia wygląd/stylizację przycisku.
   */
  public setAppearance(appearance: MaybeSignal<ErpButtonAppearance>): this {
    this._data.appearance = appearance;
    return this;
  }

  /**
   * Kontroluje zewnętrzny stan ładowania przycisku.
   */
  public setLoading(loading: MaybeSignal<boolean>): this {
    this._data.loading = loading;
    return this;
  }

  /**
   * Kontroluje stan zablokowania/wyłączenia przycisku.
   */
  public setDisabled(disabled: MaybeSignal<boolean>): this {
    this._data.disabled = disabled;
    return this;
  }

  /**
   * Ustawia ikonę początkową (po lewej stronie tekstu).
   */
  public setIconStart(iconStart: MaybeSignal<ErpIcon>): this {
    this._data.iconStart = iconStart;
    return this;
  }

  /**
   * Ustawia ikonę końcową (po prawej stronie tekstu).
   */
  public setIconEnd(iconEnd: MaybeSignal<ErpIcon>): this {
    this._data.iconEnd = iconEnd;
    return this;
  }

  /**
   * Ustawia funkcję zwrotną wywoływaną po kliknięciu.
   * Wspiera funkcje asynchroniczne (zwracające Promise) – automatycznie kontroluje wtedy stan ładowania.
   */
  public setFn(fn: () => void | Promise<void>): this {
    this._data.fn = fn;
    return this;
  }
}
