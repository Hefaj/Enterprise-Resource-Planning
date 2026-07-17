import { ErpInputBaseBuilder } from '../../base/erp-input-base';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';
import { ErpInputSize } from '../erp-input/erp-input.types';
import {
  ErpInputNumberConfig,
  ErpInputNumberMode,
  ErpInputNumberSign,
} from './erp-input-number.types';

/**
 * Klasa Builder dla komponentu ErpInputNumber, udostępniająca płynne (fluent) API
 * do tworzenia konfiguracji pola wejściowego dla liczb.
 */
export class ErpInputNumberBuilder extends ErpInputBaseBuilder<ErpInputNumberConfig> {
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
   * Ustawia domyślną/inicjalną wartość liczbową pola.
   * @param value Wartość liczbowa, null lub sygnał.
   */
  public setValue(value: MaybeSignal<number | null>): this {
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
   * Ustawia tryb pola wejściowego ('integer' lub 'decimal').
   * @param mode Tryb liczbowy: całkowity lub zmiennoprzecinkowy.
   */
  public setMode(mode: MaybeSignal<ErpInputNumberMode>): this {
    this._data.mode = mode;
    return this;
  }

  /**
   * Ustawia liczbę miejsc po przecinku (w trybie 'decimal').
   * @param decimals Liczba cyfr po przecinku (np. 2).
   */
  public setDecimals(decimals: MaybeSignal<number>): this {
    this._data.decimals = decimals;
    return this;
  }

  /**
   * Ustawia dozwolony znak wartości liczbowej ('positive', 'negative' lub 'any').
   * @param sign Dozwolony znak.
   */
  public setSign(sign: MaybeSignal<ErpInputNumberSign>): this {
    this._data.sign = sign;
    return this;
  }

  /**
   * Ustawia obecność przycisków steppera (+ / -) do zmiany wartości o określony krok.
   * @param stepper Czy włączyć stepper.
   */
  public setStepper(stepper: MaybeSignal<boolean>): this {
    this._data.stepper = stepper;
    return this;
  }

  /**
   * Ustawia minimalną dopuszczalną wartość liczbową w polu.
   * @param min Wartość minimalna.
   */
  public setMin(min: MaybeSignal<number>): this {
    this._data.min = min;
    return this;
  }

  /**
   * Ustawia maksymalną dopuszczalną wartość liczbową w polu.
   * @param max Wartość maksymalna.
   */
  public setMax(max: MaybeSignal<number>): this {
    this._data.max = max;
    return this;
  }

  /**
   * Ustawia wartość kroku (step) dla steppera.
   * @param step Krok przyrostu/spadku (np. 1 lub 0.01).
   */
  public setStep(step: MaybeSignal<number>): this {
    this._data.step = step;
    return this;
  }
}
