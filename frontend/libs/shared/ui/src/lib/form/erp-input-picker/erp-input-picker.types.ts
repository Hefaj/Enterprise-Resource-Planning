import { ErpInputBase } from '../../base/erp-input-base';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpInputSize } from '../erp-input/erp-input.types';

export type ErpInputPickerStrategy = 'single' | 'multi';

export interface ErpInputPickerConfig<T = any, V = any> extends ErpInputBase {
  /** Lista opcji (obiektów lub wartości prostych) dostępnych do wyboru */
  items?: MaybeSignal<readonly T[]>;

  /** Strategia wyboru: 'single' (pojedynczy) lub 'multi' (wielokrotny z checkboxami) */
  strategy?: MaybeSignal<ErpInputPickerStrategy>;

  /** Nazwa właściwości obiektu używana jako etykieta wyświetlana w liście (np. 'name') */
  labelKey?: MaybeSignal<keyof T | string | undefined>;

  /** Nazwa właściwości obiektu używana jako wartość zwracana/zapisywana do modelu (np. 'id') */
  valueKey?: MaybeSignal<keyof T | string | undefined>;

  /** Własna funkcja ekstrahująca tekst do wyświetlenia z obiektu T */
  displayExtractor?: MaybeSignal<((item: T) => string) | undefined>;

  /** Własna funkcja ekstrahująca wartość zwracaną V z obiektu T */
  valueExtractor?: MaybeSignal<((item: T) => V) | undefined>;

  /** Etykieta (floating label) pola */
  label?: MaybeSignal<Translatable | undefined>;

  /** Początkowa lub zboundowana wartość pola (pojedyncza lub tablica w zależności od strategii) */
  value?: MaybeSignal<any>;

  /** Tekst zastępczy (placeholder) dla pola wyszukiwania w liście lub inpucie */
  searchPlaceholder?: MaybeSignal<Translatable | undefined>;

  /** Tekst wyświetlany, gdy brak wyników wyszukiwania po przefiltrowaniu (np. 'Brak danych') */
  emptyContent?: MaybeSignal<Translatable | undefined>;

  /** Dla wyboru pojedynczego ('single'): czy wpisywana wartość musi ściśle pasować do pozycji na liście opcji */
  strict?: MaybeSignal<boolean>;

  /** Rozmiar pola input ('s', 'm', 'l') */
  size?: MaybeSignal<ErpInputSize>;

  /**
   * Włącza wirtualizację listy opcji (Angular CDK Virtual Scroll).
   * Wymagane przy listach > ~200 pozycji. Podaj wysokość jednego elementu w px (domyślnie 40).
   */
  virtualScroll?: MaybeSignal<boolean | number>;

  /**
   * Dla wyboru wielokrotnego ('multi'): maksymalna liczba wyświetlanych elementów w inpucie,
   * po przekroczeniu której wyświetlany jest podsumowujący napis "Zaznaczone (X)".
   */
  maxCollapseCount?: MaybeSignal<number>;

  /**
   * Asynchroniczna funkcja wyszukiwania i paginacji (zwraca listę UUID/identyfikatorów).
   * Wywoływana przy otwarciu listy, wpisywaniu tekstu oraz przewijaniu do kolejnych stron.
   */
  searchFn?: MaybeSignal<((query: ErpInputPickerSearchQuery) => any) | undefined>;

  /**
   * Asynchroniczna funkcja pobierająca pełne obiekty pozycji (Item[]) na podstawie listy UUID/identyfikatorów.
   * Wywoływana dla wyników zwróconych przez searchFn oraz dla początkowych wartości w formControl.
   */
  getFn?: MaybeSignal<((uuids: string[]) => any) | undefined>;

  /**
   * Rozmiar pojedynczej strony (pageSize) używany podczas asynchronicznej paginacji (domyślnie 50).
   */
  pageSize?: MaybeSignal<number>;
}

export interface ErpInputPickerSearchQuery {
  /** Wpisana fraza wyszukiwania (filtr nazwy/SKU) */
  search: string;
  /** Numer strony (począwszy od 0) */
  pageIndex: number;
  /** Rozmiar strony (np. 50) */
  pageSize: number;
}

export type ErpInputPickerSearchResult = string[] | { uuids: string[]; totalCount?: number };
