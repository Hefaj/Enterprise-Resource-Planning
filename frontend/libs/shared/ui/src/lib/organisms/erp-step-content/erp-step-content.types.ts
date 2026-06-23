import { Type } from '@angular/core';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';

/**
 * Typ elementu treści stepu.
 *
 * - `text` — prosty blok tekstu (ErpTextComponent)
 * - `form` — formularz (ErpFormComponent)
 * - `splitter` — layout splitter (ErpSplitterComponent)
 * - `card` — karta (ErpCardComponent)
 * - `component` — dowolny komponent Angular (biznesowy lub UI)
 * - `section` — zagnieżdżona sekcja z własnymi elementami
 * - `divider` — wizualny separator
 */
export type ErpStepContentElementType =
  | 'text'
  | 'form'
  | 'splitter'
  | 'card'
  | 'component'
  | 'section'
  | 'divider';

/**
 * Pojedynczy element treści stepu.
 * Opisuje co renderować i jak to wyświetlić w layoucie.
 */
export interface ErpStepContentElement {
  /** Typ elementu determinujący sposób renderowania. */
  type: ErpStepContentElementType;
  /** Konfiguracja specyficzna dla typu elementu (np. ErpFormConfig, ErpSplitterConfig). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config?: any;
  /** Komponent Angular (używane dla type='component'). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component?: MaybeSignal<Type<any>>;
  /** Inputy przekazywane do komponentu (używane dla type='component'). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputs?: Record<string, any>;
  /** Zagnieżdżone elementy (używane dla type='section'). */
  children?: ErpStepContentElement[];
  /** Layout sekcji: 'stack' (kolumna), 'row' (wiersz), 'grid' (CSS grid). */
  layout?: MaybeSignal<'stack' | 'row' | 'grid'>;
  /** Ilość kolumn CSS Grid (używane gdy layout='grid'). */
  gridCols?: MaybeSignal<number>;
  /** Rozpiętość kolumn w parent-grid. */
  colSpan?: MaybeSignal<number>;
  /** Dodatkowa klasa CSS dla kontenera elementu. */
  styleClass?: MaybeSignal<string>;
  /** Inline style dla kontenera elementu. */
  style?: MaybeSignal<Record<string, string>>;
  /** Opcjonalny nagłówek sekcji (Translatable — tłumaczony automatycznie). */
  title?: MaybeSignal<Translatable>;
  /** Gap pomiędzy elementami w sekcji (np. '1rem', '0.5rem'). */
  gap?: MaybeSignal<string>;
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
