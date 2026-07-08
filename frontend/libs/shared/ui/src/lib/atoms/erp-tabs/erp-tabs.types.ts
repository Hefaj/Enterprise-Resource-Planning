import { Type } from '@angular/core';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';
import { ErpIcon } from '../../base/erp-icon.types';

/**
 * Konfiguracja pojedynczej zakładki w komponencie ErpTabs.
 */
export interface ErpTabItem<TComponent = any> {
  /** Klucz tłumaczenia lub tekst wyświetlany na zakładce. */
  label: Translatable;
  /** Unikalny identyfikator zakładki. */
  id: string;
  /** Komponent wyświetlany w panelu zakładki. */
  component?: Type<TComponent>;
  /** Inputy przekazywane do dynamicznego komponentu. */
  inputs?: ErpComponentSignalInputs<TComponent>;
  /** Ikona TaigaUI wyświetlana obok etykiety (np. '@tui.shopping-bag'). */
  icon?: ErpIcon;
  /** Czy zakładka może być zamknięta przez użytkownika. */
  closable?: boolean;
  /** Czy zakładka jest wyłączona (disabled). */
  disabled?: boolean;
  /** Pod-zakładki (zagnieżdżone zakładki). */
  children?: ErpTabItem[];
}

/**
 * Konfiguracja komponentu ErpTabs.
 *
 * Umożliwia tworzenie zakładek z dynamicznymi komponentami,
 * wsparciem dla zagnieżdżonego routingu, zamykania zakładek
 * i pełnej konfiguracji poprzez builder.
 */
export interface ErpTabsConfig {
  /** Lista zakładek do wyrenderowania. */
  tabs: ErpTabItem[];
  /** ID początkowej aktywnej zakładki. */
  initialValue?: string;
  /** Callback wywoływany po zmianie aktywnej zakładki (id zakładki). */
  onTabChange?: (tabId: string) => void;
  /** Callback wywoływany przy zamykaniu zakładki (id zakładki). Zwraca void lub Promise. */
  onTabClose?: (tabId: string) => void | Promise<void>;
  /** Rozmiar zakładek TaigaUI ('m' | 'l'). */
  size?: MaybeSignal<'m' | 'l'>;
  /** Czy wyświetlać podkreślenie aktywnej zakładki. */
  underline?: MaybeSignal<boolean>;
}
