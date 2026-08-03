import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';

/**
 * Akcja wyświetlana w nagłówku grupy (np. "Usuń wszystkie", "Dodaj").
 */
export interface ErpGroupCardAction {
  /** Etykieta akcji (translatable). */
  label: Translatable;
  /** Ikona akcji. */
  icon?: ErpIcon;
  /** Callback wykonywany po kliknięciu. */
  onClick: () => void | Promise<void>;
  /** Czy akcja jest zablokowana. */
  disabled?: MaybeSignal<boolean>;
}

/**
 * Konfiguracja komponentu ErpGroupCard.
 *
 * Reużywalny card z nagłówkiem (tytuł, podtytuł, ikona, akcje) i slotowaną treścią.
 * Służy jako wizualny kontener grupy, np. multimedia jednego produktu w trybie multi-select.
 */
export interface ErpGroupCardConfig {
  /** Tytuł grupy (translatable). */
  title: MaybeSignal<Translatable>;
  /** Podtytuł (np. SKU produktu). */
  subtitle?: MaybeSignal<Translatable>;
  /** Ikona w nagłówku. */
  icon?: MaybeSignal<ErpIcon>;
  /** Czy card jest rozwinięty. Domyślnie true (expanded). */
  expanded?: MaybeSignal<boolean>;
  /** Czy karta jest zaznaczona (highlight border). */
  selected?: MaybeSignal<boolean>;
  /** Callback na toggle rozwinięcia. */
  onToggle?: (expanded: boolean) => void;
  /** Akcje w nagłówku. */
  actions?: ErpGroupCardAction[];
  /** Czy wyświetlić skeleton-loader gdy treść nie jest załadowana. */
  loading?: MaybeSignal<boolean>;
  /**
   * Minimalna wysokość (px) zanim treść się załaduje.
   * Pomaga TanStack Virtual szacować rozmiar elementu przed pomiarem.
   */
  placeholderHeight?: MaybeSignal<number>;
}
