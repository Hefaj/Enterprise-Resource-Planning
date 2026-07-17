import { Type } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
export type ErpFormFieldType = 'text' | 'number' | 'switch' | 'color' | 'checkbox' | 'custom';

/**
 * Discriminated union elementów treści stepu.
 *
 * - `component` — dowolny komponent Angular renderowany przez `ngComponentOutlet`
 * - `section` — zagnieżdżona sekcja z własnymi elementami (rekurencja)
 * - `divider` — wizualny separator (`<hr>`)
 * - `formField` — pojedyncze płaskie pole formularza renderowane bezpośrednio w layoucie
 */
export type ErpStepContentElement =
  | ErpStepContentComponentElement
  | ErpStepContentSectionElement
  | ErpStepContentDividerElement
  | ErpStepContentFormFieldElement;

/**
 * Element reprezentujący pojedyncze pole formularza w layoucie.
 * Pozwala rozproszyć pola formularza i przeplatać je dowolnymi elementami.
 * Wszystkie pola współdzielą jedną centralną instancję FormGroup z kroku.
 */
export interface ErpStepContentFormFieldElement {
  type: 'formField';
  /** Unikalny klucz kontrolki w FormGroup. */
  key: string;
  /** Typ kontrolki. */
  fieldType: ErpFormFieldType;
  /** Klasa komponentu Angular wyznaczona do renderowania tego pola. */
  component: Type<any>;
  /** Konfiguracja specyficzna dla danej kontrolki. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any;
  /** Sygnał lub funkcja zwracająca bieżącą wartość z modelu. */
  value?: MaybeSignal<any> | (() => any);
  /** Callback uruchamiany przy zmianie wartości (tylko gdy kontrolka przejdzie walidację). */
  onChange?: (value: any) => void;
  /** Rozpiętość kolumn w parent-grid. */
  colSpan?: MaybeSignal<number>;
  /** Nazwa grid-area slotu (używane z setGridAreas). */
  slot?: string;
  /** Dodatkowa klasa CSS dla kontenera elementu. */
  styleClass?: MaybeSignal<string>;
  /** Inline style dla kontenera elementu. */
  style?: MaybeSignal<Record<string, string>>;
}

/**
 * Konfiguracja CSS Grid Template Areas dla zaawansowanych layoutów.
 *
 * Pozwala deklaratywnie definiować złożone rozmieszczenie elementów
 * bez pisania surowego CSS. Elementy przypisuje się do slotów
 * za pomocą pola `slot` na elementach.
 *
 * @example
 * ```ts
 * {
 *   template: [
 *     'header  header',
 *     'form    preview',
 *     'footer  footer',
 *   ],
 *   columns: '1fr 1fr',
 *   rows: 'auto 1fr auto',
 *   gap: '1rem',
 * }
 * ```
 */
export interface ErpGridAreasConfig {
  /** Definicja grid-template-areas — tablica stringów (wiersze gridu). */
  template: string[];
  /** grid-template-columns (np. '1fr 2fr', '250px 1fr'). Domyślnie: equal columns wyliczone z template. */
  columns?: MaybeSignal<string>;
  /** grid-template-rows (np. 'auto 1fr auto'). Domyślnie: auto. */
  rows?: MaybeSignal<string>;
  /** Gap pomiędzy cellami (np. '1rem'). */
  gap?: MaybeSignal<string>;
}

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
  /** Nazwa grid-area slotu (używane z setGridAreas). */
  slot?: string;
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
  /** Zaawansowana konfiguracja CSS Grid Areas (wewnątrz sekcji). */
  gridAreas?: ErpGridAreasConfig;
  /** Ilość kolumn CSS Grid (używane gdy layout='grid'). */
  gridCols?: MaybeSignal<number>;
  /** Gap pomiędzy elementami w sekcji (np. '1rem', '0.5rem'). */
  gap?: MaybeSignal<string>;
  /** Opcjonalny nagłówek sekcji (Translatable — tłumaczony automatycznie). */
  title?: MaybeSignal<Translatable>;
  /** Rozpiętość kolumn w parent-grid. */
  colSpan?: MaybeSignal<number>;
  /** Nazwa grid-area slotu (używane z setGridAreas). */
  slot?: string;
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
  /** Nazwa grid-area slotu (używane z setGridAreas). */
  slot?: string;
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
  /** Zaawansowana konfiguracja CSS Grid Areas. Gdy ustawione, nadpisuje layout/gridCols. */
  gridAreas?: ErpGridAreasConfig;
  /** Ilość kolumn CSS Grid (używane gdy layout='grid'). */
  gridCols?: MaybeSignal<number>;
  /** Gap pomiędzy elementami (np. '1rem'). */
  gap?: MaybeSignal<string>;
  /** Dodatkowa klasa CSS dla root kontenera. */
  styleClass?: MaybeSignal<string>;
  /** Inline style dla root kontenera (escape hatch — surowe CSS properties). */
  rootStyle?: MaybeSignal<Record<string, string>>;
  /** Centralna FormGroup dla wszystkich zadeklarowanych w stepie pól formularza. */
  formGroup: FormGroup;
}
