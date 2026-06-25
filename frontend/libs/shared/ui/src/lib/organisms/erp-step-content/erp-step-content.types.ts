import { Type } from '@angular/core';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';

/**
 * Discriminated union elementów treści stepu.
 *
 * - `component` — dowolny komponent Angular renderowany przez `ngComponentOutlet`
 * - `section` — zagnieżdżona sekcja z własnymi elementami (rekurencja)
 * - `divider` — wizualny separator (`<hr>`)
 */
export type ErpStepContentElement =
  | ErpStepContentComponentElement
  | ErpStepContentSectionElement
  | ErpStepContentDividerElement;

/**
 * Element renderowany przez `ngComponentOutlet`.
 * Zastępuje poprzednie dedykowane typy (`text`, `form`, `splitter`, `card`, `component`).
 * Builder ustawia `component` i `inputs` — komponent docelowy nie musi nic wiedzieć
 * o konkretnych typach elementów.
 */
export interface ErpStepContentComponentElement {
  type: 'component';
  /** Klasa komponentu Angular do renderowania. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: Type<any>;
  /** Inputy przekazywane do komponentu przez ngComponentOutlet. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputs?: Record<string, any>;
  /** Rozpiętość kolumn w parent-grid. */
  colSpan?: MaybeSignal<number>;
  /** Dodatkowa klasa CSS dla kontenera elementu. */
  styleClass?: MaybeSignal<string>;
  /** Inline style dla kontenera elementu. */
  style?: MaybeSignal<Record<string, string>>;
}

/**
 * Zagnieżdżona sekcja z własnymi elementami.
 * Renderowana rekurencyjnie przez `<erp-step-content>`.
 */
export interface ErpStepContentSectionElement {
  type: 'section';
  /** Zagnieżdżone elementy sekcji. */
  children: ErpStepContentElement[];
  /** Layout sekcji: 'stack' (kolumna), 'row' (wiersz), 'grid' (CSS grid). */
  layout?: MaybeSignal<'stack' | 'row' | 'grid'>;
  /** Ilość kolumn CSS Grid (używane gdy layout='grid'). */
  gridCols?: MaybeSignal<number>;
  /** Gap pomiędzy elementami w sekcji (np. '1rem', '0.5rem'). */
  gap?: MaybeSignal<string>;
  /** Opcjonalny nagłówek sekcji (Translatable — tłumaczony automatycznie). */
  title?: MaybeSignal<Translatable>;
  /** Rozpiętość kolumn w parent-grid. */
  colSpan?: MaybeSignal<number>;
  /** Dodatkowa klasa CSS dla kontenera elementu. */
  styleClass?: MaybeSignal<string>;
  /** Inline style dla kontenera elementu. */
  style?: MaybeSignal<Record<string, string>>;
}

/**
 * Wizualny separator — renderowany jako `<hr>`.
 */
export interface ErpStepContentDividerElement {
  type: 'divider';
  /** Dodatkowa klasa CSS dla separatora. */
  styleClass?: MaybeSignal<string>;
  /** Inline style dla separatora. */
  style?: MaybeSignal<Record<string, string>>;
}

/**
 * Główna konfiguracja treści stepu.
 * Wynikowy obiekt tworzony przez ErpStepContentBuilder.
 */
export interface ErpStepContentConfig {
  /** Lista elementów treści stepu. */
  elements: ErpStepContentElement[];
  /** Domyślny layout root kontenera. */
  layout?: MaybeSignal<'stack' | 'row' | 'grid'>;
  /** Ilość kolumn CSS Grid (używane gdy layout='grid'). */
  gridCols?: MaybeSignal<number>;
  /** Gap pomiędzy elementami (np. '1rem'). */
  gap?: MaybeSignal<string>;
  /** Dodatkowa klasa CSS dla root kontenera. */
  styleClass?: MaybeSignal<string>;
}
