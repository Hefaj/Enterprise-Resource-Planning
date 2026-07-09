import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';

/**
 * Typ określający wygląd wizualny/stylizację pojedynczego elementu w menu.
 */
export type ErpMenuBarItemAppearance = 'normal' | 'warning' | 'info';

/**
 * Typ określający ułożenie (kierunek) elementów menu poziomu 0.
 */
export type ErpMenuBarDirection = 'horizontal' | 'vertical';

/**
 * Konfiguracja pojedynczego elementu w menu.
 */
export interface ErpMenuBarItemConfig {
  /**
   * Treść przycisku (etykieta tekstowa). Wspiera klucze Transloco.
   * Opcjonalna (np. w przypadku separatorów).
   */
  label?: MaybeSignal<Translatable>;

  /**
   * Opcjonalny mniejszy tekst pomocniczy wyświetlany pod główną etykietą.
   */
  subLabel?: MaybeSignal<Translatable>;

  /**
   * Tekst podpowiedzi (tooltip). Jeśli jest zdefiniowany, obok elementu wyświetli się ikona informacyjna (i),
   * która po najechaniu pokaże tę podpowiedź.
   */
  hint?: MaybeSignal<Translatable>;

  /**
   * Ikona początkowa wyświetlana po lewej stronie tekstu.
   */
  iconStart?: MaybeSignal<ErpIcon>;

  /**
   * Ikona końcowa wyświetlana po prawej stronie tekstu.
   * W przypadku elementów z podmenu (children) jest zastępowana strzałką (chevron-right).
   */
  iconEnd?: MaybeSignal<ErpIcon>;

  /**
   * Stan zablokowania/wyłączenia elementu menu.
   */
  disabled?: MaybeSignal<boolean>;

  /**
   * Opcjonalny separator (linia pozioma) wyświetlany przed tym elementem.
   */
  separator?: MaybeSignal<boolean>;

  /**
   * Wygląd/stylizacja elementu menu ('normal' | 'warning' | 'info').
   */
  appearance?: MaybeSignal<ErpMenuBarItemAppearance>;

  /**
   * Czy menu ma się automatycznie zamknąć po kliknięciu tej pozycji. Domyślnie true.
   */
  closeOnClick?: MaybeSignal<boolean>;

  /**
   * Metoda zwrotna wywoływana po kliknięciu. Może być asynchroniczna (zwracać Promise).
   * Na czas trwania metody wyświetlany jest loader.
   */
  fn?: () => void | Promise<void>;

  /**
   * Zagnieżdżone elementy menu (podmenu).
   */
  children?: ErpMenuBarItemConfig[];
}

/**
 * Główna konfiguracja komponentu ErpMenuBar.
 */
export interface ErpMenuBarConfig {
  /**
   * Elementy menu poziomu 0.
   */
  items: ErpMenuBarItemConfig[];

  /**
   * Kierunek rozłożenia elementów na poziomie 0 ('horizontal' | 'vertical'). Domyślnie 'horizontal'.
   */
  direction?: MaybeSignal<ErpMenuBarDirection>;
}
