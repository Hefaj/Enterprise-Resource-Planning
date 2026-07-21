import { Type, InputSignal, InputSignalWithTransform } from '@angular/core';
import { PolymorpheusContent } from '@taiga-ui/polymorpheus';
import { ErpInputBase } from '../../base/erp-input-base';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpInputSize } from '../erp-input/erp-input.types';

export type ErpSelectStrategy = 'single' | 'multi';

/**
 * Typ określający bezpieczny typowo komponent dla pojedynczego elementu opcji.
 * Komponent musi posiadać input 'item' (np. `item = input.required<T>()`).
 */
export type ErpSelectItemComponent<T> = Type<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item: InputSignal<T> | InputSignalWithTransform<T, any> | T;
}>;

export interface ErpSelectConfig<T = unknown> extends ErpInputBase {
  /** Wartość inicjalna pola wyboru. */
  value?: MaybeSignal<T | T[] | undefined>;

  /** Lista opcji do wyboru. */
  items?: MaybeSignal<T[]>;

  /** Strategia wyboru: 'single' (pojedynczy) lub 'multi' (wielokrotny). Domyślnie 'single'. */
  strategy?: MaybeSignal<ErpSelectStrategy>;

  /** Rozmiar pola input ('s', 'm', 'l'). Domyślnie 'm'. */
  size?: MaybeSignal<ErpInputSize>;

  /** Etykieta pola (label). */
  label?: MaybeSignal<Translatable | undefined>;

  /** Funkcja przekształcająca obiekt opcji na ciąg znaków do wyświetlenia. */
  stringify?: MaybeSignal<((item: T) => string) | undefined>;

  /** Funkcja porównująca dwa elementy pod kątem tożsamości. */
  identityMatcher?: MaybeSignal<((a: T, b: T) => boolean) | undefined>;

  /**
   * Maksymalna liczba chipów wyświetlanych przy wyborze wielokrotnym (strategy = 'multi').
   * Po przekroczeniu tej liczby wyświetlane jest podsumowanie tekstowe (Wariant A), np. "Wybranych elementów (X)".
   * Domyślnie 3.
   */
  maxChipsCount?: MaybeSignal<number>;

  /** Funkcja formatująca tekst podsumowania gdy przekroczono maxChipsCount. */
  summaryFormatter?: MaybeSignal<((count: number) => Translatable) | undefined>;

  /** Customowa zawartość nagłówka w rozwijanej liście opcji. */
  headerContent?: MaybeSignal<PolymorpheusContent<unknown> | undefined>;

  /** Własny szablon/HTML pozycji opcji (np. TemplateRef, string). */
  itemContent?: MaybeSignal<PolymorpheusContent<{ $implicit: T }> | undefined>;

  /** Customowy komponent Angular renderujący pojedynczy element opcji. */
  itemComponent?: MaybeSignal<ErpSelectItemComponent<T> | undefined>;

  /** Czy włączyć wirtualizację listy opcji za pomocą CDK Virtual Scroll. */
  virtualScroll?: MaybeSignal<boolean>;

  /** Wysokość pojedynczej opcji w pikselach (wymagana dla wirtualizacji). Domyślnie 44. */
  itemSize?: MaybeSignal<number>;

  /** Czy włączyć pole wyszukiwania/filtrowania opcji. */
  searchable?: MaybeSignal<boolean>;
}
