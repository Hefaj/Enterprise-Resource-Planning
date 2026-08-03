import { MaybeSignal } from '../../base/erp-signal-utils';

/**
 * Zakres widocznych elementów zwracany przez callback onRangeChange.
 */
export interface ErpVisibleRange {
  /** Indeks pierwszego widocznego elementu. */
  startIndex: number;
  /** Indeks ostatniego widocznego elementu. */
  endIndex: number;
  /** Klucze widocznych elementów (z getItemKey). */
  visibleKeys: string[];
}

/**
 * Konfiguracja komponentu ErpScrollViewport.
 *
 * Generyczny wrapper nad TanStack Virtual (injectVirtualizer), zapewniający
 * wirtualizację list elementów o zmiennej wysokości z lazy-loading callbackami.
 *
 * @template TItem Typ elementu na liście.
 */
export interface ErpScrollViewportConfig<TItem = any> {
  /** Lista elementów do wirtualizacji. */
  items: MaybeSignal<TItem[]>;

  /** Funkcja zwracająca unikalny klucz dla elementu (np. UUID). */
  getItemKey: (index: number, item: TItem) => string;

  /**
   * Szacunkowa wysokość elementu w px (domyślnie 200).
   * Lepiej przeszacować niż niedoszacować — TanStack mierzy faktyczny rozmiar po renderze.
   */
  estimateSize?: MaybeSignal<number>;

  /** Ilość elementów do pre-renderowania poza viewport (domyślnie 3). */
  overscan?: MaybeSignal<number>;

  /**
   * Callback gdy zakres widocznych elementów się zmieni.
   * Użyj do triggerowania lazy-load danych (np. multimediów per grupa).
   */
  onRangeChange?: (range: ErpVisibleRange) => void;

  /** Margines scrollu (px) przed początkiem listy. */
  paddingStart?: MaybeSignal<number>;

  /** Margines scrollu (px) za końcem listy. */
  paddingEnd?: MaybeSignal<number>;
}
