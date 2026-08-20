import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';

/**
 * Pojedynczy cel operacji masowej wymieniony w opisie banera.
 * `label: null` renderuje `loadingKey` (pozycja jeszcze się doczytuje z orkiestratora).
 */
export interface ErpBatchTargetItem {
  readonly uuid: string;
  readonly label: string | null;
}

/**
 * Konfiguracja podsumowania celów kroku modalu operacji masowej
 * (`BatchCommand<TCommand, TFilter>`) — komunikat "Edytujesz N pozycji" w banerze
 * (patrz `erp-selection-scope-banner`), z listą nazw celów albo hintem trybu filtra
 * ("Zaznacz wszystko").
 *
 * Zastępuje ręcznie pisany blok `@if (isFilterMode()) {...} @else if (...) {...}`
 * powtarzany dotąd w każdym kroku modalu wsadowego.
 */
export interface ErpBatchTargetsSummaryConfig {
  /**
   * Cele operacji do wymienienia w opisie banera (tryb jawnych identyfikatorów).
   *
   * Przyjmuje też zwykły getter (`() => ...`) — nie tylko `Signal` — bo config jest
   * zwykle budowany w konstruktorze kroku modalu PRZED wywołaniem `super()`, kiedy pola
   * bazy (`ErpBatchStepBase.targetUuids` itp.) jeszcze nie istnieją. Getter odracza
   * odczyt `this` do pierwszego renderu, gdy konstrukcja jest już zakończona.
   */
  items: MaybeSignal<ErpBatchTargetItem[]> | (() => ErpBatchTargetItem[]);
  /** Liczba pozycji objętych operacją (w trybie filtra pochodzi z metadanych). Patrz `items`. */
  targetCount: MaybeSignal<number> | (() => number);
  /** Tryb „Zaznacz wszystko" — cele wyznaczy backend, frontend ich nie zna. Patrz `items`. */
  isFilterMode: MaybeSignal<boolean> | (() => boolean);
  /** Klucz komunikatu głównego, np. "Edytujesz". */
  messageKey: MaybeSignal<Translatable>;
  /** Klucz sufiksu dla dokładnie jednej pozycji, np. "produkt". */
  suffixSingleKey: MaybeSignal<Translatable>;
  /** Klucz sufiksu dla wielu pozycji, np. "produktów". */
  suffixPluralKey: MaybeSignal<Translatable>;
  /** Klucz dopowiedzenia w trybie filtra, np. "spełniających bieżący filtr". */
  filterModeSuffixKey: MaybeSignal<Translatable>;
  /** Klucz hintu pod komunikatem w trybie filtra. */
  filterModeHintKey: MaybeSignal<Translatable>;
  /** Klucz tekstu, gdy nie ma żadnych celów (ani uuidów, ani filtra). Pominięty — blok się nie renderuje. */
  emptyKey?: MaybeSignal<Translatable>;
  /** Klucz tekstu placeholder dla pozycji, której `label` jeszcze wynosi `null`. */
  loadingKey?: MaybeSignal<Translatable>;
}
