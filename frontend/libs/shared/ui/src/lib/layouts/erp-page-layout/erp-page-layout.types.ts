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
  sidebarWidth?: MaybeSignal<number>;
  /** Czy sidebar jest zwinięty/ukryty (domyślnie false). */
  sidebarCollapsed?: MaybeSignal<boolean>;
}
