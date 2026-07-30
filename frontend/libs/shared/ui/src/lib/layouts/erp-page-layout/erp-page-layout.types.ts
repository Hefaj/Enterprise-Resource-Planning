import { Type } from '@angular/core';
import { MaybeSignal } from '../../base/erp-signal-utils';
import { ErpComponentSignalInputs } from '../../base/erp-component-signal-inputs';

/**
 * Konfiguracja slotu dynamicznego komponentu w layoucie strony.
 * Przechowuje referencję do komponentu oraz opcjonalne inputy.
 */
export interface ErpPageLayoutSlot<TComponent = any> {
  component: Type<TComponent>;
  inputs?: ErpComponentSignalInputs<TComponent>;
}

/**
 * Konfiguracja layoutu strony (Page Layout).
 *
 * Definiuje strukturę strony składającą się z opcjonalnego lewego sidebara (filtry)
 * oraz głównej sekcji (main content).
 *
 * Sidebar może być dynamicznie ukrywany/pokazywany — wtedy sekcja main
 * zajmuje całą dostępną przestrzeń.
 */
export interface ErpPageLayoutConfig {
  /** Komponent wyświetlany w lewym sidebarze (np. filtry). */
  leftSidebar?: ErpPageLayoutSlot;
  /** Komponent wyświetlany w głównej sekcji strony. */
  main?: ErpPageLayoutSlot;
  /** Szerokość sidebara w px (domyślnie 280). */
  leftSidebarWidth?: MaybeSignal<number>;
  /** Czy sidebar jest zwinięty/ukryty (domyślnie false). */
  leftSidebarCollapsed?: MaybeSignal<boolean>;
  /** Tryb działania sidebara (push - przesuwa kontent, overlay - nachodzi na kontent). Domyślnie push. */
  leftSidebarMode?: MaybeSignal<'push' | 'overlay'>;
  /** Czy lewy sidebar może być skalowany przez użytkownika (domyślnie true). */
  leftSidebarResizable?: MaybeSignal<boolean>;
  /** Minimalna szerokość lewego sidebara (domyślnie 100). */
  leftSidebarMinWidth?: MaybeSignal<number>;
  /** Maksymalna szerokość lewego sidebara (domyślnie 800). */
  leftSidebarMaxWidth?: MaybeSignal<number>;

  /** Komponent wyświetlany w prawym sidebarze. */
  rightSidebar?: ErpPageLayoutSlot;
  /** Szerokość prawego sidebara w px (domyślnie 280). */
  rightSidebarWidth?: MaybeSignal<number>;
  /** Czy prawy sidebar jest zwinięty/ukryty (domyślnie false). */
  rightSidebarCollapsed?: MaybeSignal<boolean>;
  /** Tryb działania prawego sidebara (push | overlay). Domyślnie push. */
  rightSidebarMode?: MaybeSignal<'push' | 'overlay'>;
  /** Czy prawy sidebar może być skalowany przez użytkownika (domyślnie true). */
  rightSidebarResizable?: MaybeSignal<boolean>;
  /** Minimalna szerokość prawego sidebara (domyślnie 100). */
  rightSidebarMinWidth?: MaybeSignal<number>;
  /** Maksymalna szerokość prawego sidebara (domyślnie 800). */
  rightSidebarMaxWidth?: MaybeSignal<number>;

  /** Opcjonalne ID layoutu, na podstawie którego zapisywane są ustawienia (szerokości) w UserPreferencesService. */
  layoutId?: string;
}
