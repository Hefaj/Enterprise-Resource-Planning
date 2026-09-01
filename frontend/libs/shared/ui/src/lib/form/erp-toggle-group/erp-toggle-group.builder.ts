import { ErpInputBaseBuilder } from '../../base/erp-input-base';
import { ErpToggleGroupConfig, ErpToggleItemConfig } from './erp-toggle-group.types';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';

/**
 * Builder dla pojedynczego elementu w grupie przycisków typu toggle.
 */
export class ErpToggleBuilder extends ErpInputBaseBuilder<ErpToggleItemConfig> {
  /**
   * Ustawia unikalną wartość przypisaną do tego elementu.
   * Wartość ta będzie zwracana w przypadku zaznaczenia tego elementu.
   */
  public setValue(value: any): this {
    this._data.value = value;
    return this;
  }

  /**
   * Ustawia główny tekst wyświetlany na przycisku.
   */
  public setText(text: MaybeSignal<Translatable> | undefined): this {
    this._data.text = text;
    return this;
  }

  /**
   * Ustawia opcjonalny tekst pomocniczy (podtytuł) wyświetlany pod głównym tekstem.
   */
  public setSubtext(subtext: MaybeSignal<Translatable>): this {
    this._data.subtext = subtext;
    return this;
  }

  /**
   * Ustawia ikonę wyświetlaną przed tekstem przycisku.
   */
  public setIconStart(icon: MaybeSignal<string>): this {
    this._data.iconStart = icon;
    return this;
  }

  /**
   * Ustawia ikonę wyświetlaną po tekście przycisku.
   */
  public setIconEnd(icon: MaybeSignal<string>): this {
    this._data.iconEnd = icon;
    return this;
  }
}

/**
 * Builder dla grupy przycisków typu toggle.
 * Pozwala na konfigurowanie zachowania całej grupy (tryb, kierunek) oraz dodawanie poszczególnych elementów.
 */
export class ErpToggleGroupBuilder extends ErpInputBaseBuilder<ErpToggleGroupConfig> {
  constructor() {
    super();
    this._data.items = [];
    this._data.mode = 'single';
    this._data.direction = 'horizontal';
  }

  /**
   * Ustawia kierunek ułożenia przycisków w grupie (poziomy lub pionowy).
   */
  public setDirection(direction: MaybeSignal<'horizontal' | 'vertical'>): this {
    this._data.direction = direction;
    return this;
  }

  /**
   * Ustawia tryb wyboru:
   * - 'single' (domyślnie): pozwala wybrać tylko jeden element naraz (radio).
   * - 'multi': pozwala na wybranie wielu elementów (checkbox).
   */
  public setMode(mode: 'single' | 'multi'): this {
    this._data.mode = mode;
    return this;
  }

  /**
   * Dodaje nowy przycisk do grupy.
   * @param configure Funkcja konfiguracyjna buildera pojedynczego elementu.
   */
  public addItem(configure: (builder: ErpToggleBuilder) => void): this {
    const builder = new ErpToggleBuilder();
    configure(builder);
    this._data.items!.push(builder.build());
    return this;
  }

  /**
   * Ustawia rozmiar elementów w grupie.
   * - 's' (mały)
   * - 'm' (średni - domyślnie)
   * - 'l' (duży)
   */
  public setSize(size: MaybeSignal<'s' | 'm' | 'l'>): this {
    this._data.size = size;
    return this;
  }
}
