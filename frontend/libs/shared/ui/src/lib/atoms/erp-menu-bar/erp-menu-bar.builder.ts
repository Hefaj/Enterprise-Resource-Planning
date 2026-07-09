import { ErpBaseBuilder } from '../../base/erp-base-builder';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';
import {
  ErpMenuBarConfig,
  ErpMenuBarItemAppearance,
  ErpMenuBarItemConfig,
} from './erp-menu-bar.types';

/**
 * Klasa Builder dla pojedynczej pozycji w menu (ErpMenuBarItemConfig).
 * Pozwala na wygodne i czytelne definiowanie właściwości pojedynczego elementu za pomocą Fluent API.
 */
export class ErpMenuBarItemBuilder extends ErpBaseBuilder<ErpMenuBarItemConfig> {
  /**
   * Ustawia etykietę tekstową elementu menu (wspiera tłumaczenia).
   * @param label Tekst lub obiekt klucza tłumaczenia Transloco.
   */
  public setLabel(label: MaybeSignal<Translatable>): this {
    this._data.label = label;
    return this;
  }

  /**
   * Ustawia mniejszy tekst pomocniczy (pod-etykietę) wyświetlaną pod głównym tekstem.
   * @param subLabel Tekst lub obiekt klucza tłumaczenia Transloco.
   */
  public setSubLabel(subLabel: MaybeSignal<Translatable>): this {
    this._data.subLabel = subLabel;
    return this;
  }

  /**
   * Ustawia tekst podpowiedzi (tooltip). Jeśli jest ustawiony, w menu pojawi się ikonka (i)
   * otwierająca dymek z podpowiedzią po najechaniu myszką.
   * @param hint Tekst podpowiedzi lub klucz tłumaczenia.
   */
  public setHint(hint: MaybeSignal<Translatable>): this {
    this._data.hint = hint;
    return this;
  }

  /**
   * Ustawia ikonę początkową (wyświetlaną z lewej strony).
   * @param icon Nazwa ikony (z rejestru ErpIcon).
   */
  public setIconStart(icon: MaybeSignal<ErpIcon>): this {
    this._data.iconStart = icon;
    return this;
  }

  /**
   * Ustawia ikonę końcową (wyświetlaną z prawej strony).
   * Uwaga: Jeśli element ma podmenu, ikona końcowa zostanie automatycznie zastąpiona strzałką submenu.
   * @param icon Nazwa ikony (z rejestru ErpIcon).
   */
  public setIconEnd(icon: MaybeSignal<ErpIcon>): this {
    this._data.iconEnd = icon;
    return this;
  }

  /**
   * Ustawia stan zablokowania elementu menu.
   * @param disabled Czy element ma być zablokowany.
   */
  public setDisabled(disabled: MaybeSignal<boolean>): this {
    this._data.disabled = disabled;
    return this;
  }

  /**
   * Dodaje separator jako podrzędny element menu (linia pozioma w submenu).
   */
  public addSeparator(): this {
    if (!this._data.children) {
      this._data.children = [];
    }
    this._data.children.push({ separator: true });
    return this;
  }

  /**
   * Ustawia styl/wygląd elementu menu.
   * Dostępne wartości:
   * - 'normal': standardowy wygląd opcji (domyślny)
   * - 'warning': ostrzeżenie (kolorystyka ostrzegawcza/pomarańczowa)
   * - 'info': informacyjny (kolorystyka informacyjna/niebieska)
   * @param appearance Wybrany styl elementu.
   */
  public setAppearance(appearance: MaybeSignal<ErpMenuBarItemAppearance>): this {
    this._data.appearance = appearance;
    return this;
  }

  /**
   * Określa, czy po kliknięciu tej pozycji całe menu powinno się zamknąć.
   * @param close Czy zamykać menu (domyślnie true).
   */
  public setCloseOnClick(close: MaybeSignal<boolean>): this {
    this._data.closeOnClick = close;
    return this;
  }

  /**
   * Ustawia akcję (metodę zwrotną) wywoływaną po kliknięciu elementu menu.
   * Obsługuje metody synchroniczne i asynchroniczne (zwracające Promise).
   * W przypadku akcji asynchronicznej element menu automatycznie wyświetli loader na czas jej wykonywania.
   * @param fn Funkcja wywoływana po kliknięciu.
   */
  public setFn(fn: () => void | Promise<void>): this {
    this._data.fn = fn;
    return this;
  }

  /**
   * Ustawia zagnieżdżone pozycje menu (podmenu).
   * Akceptuje tablicę obiektów konfiguracyjnych lub innych Builderów.
   * @param children Tablica dzieci/podmenu.
   */
  public setChildren(
    children: (ErpMenuBarItemConfig | ErpMenuBarItemBuilder)[]
  ): this {
    this._data.children = children.map(child => this._extract(child));
    return this;
  }

  /**
   * Dodaje pojedyncze podmenu do tej pozycji paska menu.
   * Pozwala na wygodne zagnieżdżanie w strukturze Fluent API.
   * @param configure Funkcja konfigurująca builder podmenu.
   */
  public addChild(configure: (builder: ErpMenuBarItemBuilder) => void): this {
    if (!this._data.children) {
      this._data.children = [];
    }
    const builder = new ErpMenuBarItemBuilder();
    configure(builder);
    this._data.children.push(builder.build());
    return this;
  }
}

/**
 * Klasa Builder dla całego paska menu (ErpMenuBarConfig).
 * Pozwala na wygodną definicję poziomu 0 paska menu i jego orientacji.
 */
export class ErpMenuBarBuilder extends ErpBaseBuilder<ErpMenuBarConfig> {
  /**
   * Dodaje nową pozycję poziomu 0 do paska menu.
   * Przyjmuje funkcję konfigurującą builder pozycji.
   * @param configure Funkcja konfigurująca builder pozycji.
   */
  public addItem(configure: (builder: ErpMenuBarItemBuilder) => void): this {
    if (!this._data.items) {
      this._data.items = [];
    }
    const builder = new ErpMenuBarItemBuilder();
    configure(builder);
    this._data.items.push(builder.build());
    return this;
  }

  /**
   * Dodaje separator jako element poziomu 0 w pasku menu.
   */
  public addSeparator(): this {
    if (!this._data.items) {
      this._data.items = [];
    }
    this._data.items.push({ separator: true });
    return this;
  }

}
