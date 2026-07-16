import { ErpBaseBuilder } from './erp-base-builder';
import { MaybeSignal, Translatable } from './erp-signal-utils';

/**
 * Bazowy interfejs dla konfiguracji pól wejściowych (formularzowych).
 */
export interface ErpInputBase {
  /** Tekst zastępczy (placeholder) pola. */
  placeholder?: MaybeSignal<Translatable | undefined>;
  
  /** Wiadomość pomocnicza wyświetlana jako podpowiedź (tooltip) nad polem. */
  tooltip?: MaybeSignal<Translatable | undefined>;

  /** Wiadomość pomocnicza wyświetlana jako podpowiedź pod polem. */
  hint?: MaybeSignal<Translatable | undefined>;
  
  /** Słownik wiadomości o błędach walidacji (np. { required: 'Pole wymagane' }). */
  errorMessages?: MaybeSignal<Record<string, Translatable> | undefined>;

  /** Określa, czy pole wejściowe jest wyłączone z interakcji. */
  disabled?: MaybeSignal<boolean>;
}

/**
 * Bazowa klasa Builder dla konfiguracji pól wejściowych.
 * Zapewnia wspólne metody fluent API dla właściwości zdefiniowanych w ErpInputBase.
 */
export class ErpInputBaseBuilder<T extends ErpInputBase> extends ErpBaseBuilder<T> {
  /**
   * Ustawia tekst zastępczy (placeholder) dla pola wejściowego.
   * @param placeholder Tekst lub klucz tłumaczenia.
   */
  public setPlaceholder(placeholder: MaybeSignal<Translatable | undefined>): this {
    this._data.placeholder = placeholder;
    return this;
  }

  /**
   * Ustawia podpowiedź dla pola wejściowego.
   * @param hint Tekst podpowiedzi lub klucz tłumaczenia.
   */
  public setHint(hint: MaybeSignal<Translatable | undefined>): this {
    this._data.hint = hint;
    return this;
  }

    /**
   * Ustawia podpowiedź (tooltip) dla pola wejściowego.
   * @param tooltip Tekst podpowiedzi lub klucz tłumaczenia.
   */
  public setTooltip(tooltip: MaybeSignal<Translatable | undefined>): this {
    this._data.tooltip = tooltip;
    return this;
  }

  /**
   * Ustawia wiadomości o błędach walidacji pola.
   * @param messages Obiekt mapujący klucze błędów na wiadomości/tłumaczenia.
   */
  public setErrorMessages(messages: MaybeSignal<Record<string, Translatable> | undefined>): this {
    this._data.errorMessages = messages;
    return this;
  }

  /**
   * Ustawia stan wyłączenia (disabled) dla pola wejściowego.
   * @param disabled Statyczna wartość logiczna lub sygnał (Signal).
   */
  public setDisabled(disabled: MaybeSignal<boolean>): this {
    this._data.disabled = disabled;
    return this;
  }
}
