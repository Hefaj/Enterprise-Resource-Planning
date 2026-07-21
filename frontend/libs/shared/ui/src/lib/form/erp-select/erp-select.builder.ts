import { PolymorpheusContent } from '@taiga-ui/polymorpheus';
import { ErpInputBaseBuilder } from '../../base/erp-input-base';
import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpInputSize } from '../erp-input/erp-input.types';
import {
  ErpSelectConfig,
  ErpSelectItemComponent,
  ErpSelectStrategy,
} from './erp-select.types';

/**
 * Klasa Builder dla komponentu ErpSelect, udostępniająca płynne (fluent) API
 * do tworzenia konfiguracji pola wyboru opcji.
 */
export class ErpSelectBuilder<T = unknown> extends ErpInputBaseBuilder<ErpSelectConfig<T>> {
  /**
   * Ustawia domyślną/inicjalną wartość pola.
   * @param value Wartość pojedyncza, tablica lub sygnał.
   */
  public setValue(value: MaybeSignal<T | T[] | undefined>): this {
    this._data.value = value;
    return this;
  }

  /**
   * Ustawia listę opcji do wyboru.
   * @param items Tablica elementów lub sygnał reprezentujący tablicę.
   */
  public setItems(items: MaybeSignal<T[]>): this {
    this._data.items = items;
    return this;
  }

  /**
   * Ustawia strategię wyboru ('single' lub 'multi').
   * @param strategy Dostępne strategie: 'single' (pojedyncza) lub 'multi' (wielokrotna).
   */
  public setStrategy(strategy: MaybeSignal<ErpSelectStrategy>): this {
    this._data.strategy = strategy;
    return this;
  }

  /**
   * Ustawia rozmiar pola input ('s', 'm' lub 'l').
   * @param size Rozmiar: 's', 'm' lub 'l'.
   */
  public setSize(size: MaybeSignal<ErpInputSize>): this {
    this._data.size = size;
    return this;
  }

  /**
   * Ustawia etykietę (label) pola wyboru.
   * @param label Tekst etykiety lub klucz tłumaczenia.
   */
  public setLabel(label: MaybeSignal<Translatable | undefined>): this {
    this._data.label = label;
    return this;
  }

  /**
   * Ustawia funkcję przekształcającą obiekt opcji na string do wyświetlenia w widoku.
   * @param stringify Funkcja pobierająca element `T` i zwracająca string.
   */
  public setStringify(stringify: MaybeSignal<((item: T) => string) | undefined>): this {
    this._data.stringify = stringify;
    return this;
  }

  /**
   * Ustawia funkcję porównującą dwa elementy opcji.
   * @param identityMatcher Funkcja przyjmująca dwa elementy i zwracająca boolean.
   */
  public setIdentityMatcher(
    identityMatcher: MaybeSignal<((a: T, b: T) => boolean) | undefined>
  ): this {
    this._data.identityMatcher = identityMatcher;
    return this;
  }

  /**
   * Ustawia maksymalną liczbę chipów przed przełączeniem na napis podsumowujący (Wariant A).
   * @param maxChipsCount Liczba chipów (domyślnie 3).
   */
  public setMaxChipsCount(maxChipsCount: MaybeSignal<number>): this {
    this._data.maxChipsCount = maxChipsCount;
    return this;
  }

  /**
   * Ustawia funkcję formatującą tekst podsumowania gdy liczba wybranych elementów przekracza maxChipsCount.
   * @param formatter Funkcja przyjmująca liczbę i zwracająca klucz lub tekst tłumaczenia.
   */
  public setSummaryFormatter(
    formatter: MaybeSignal<((count: number) => Translatable) | undefined>
  ): this {
    this._data.summaryFormatter = formatter;
    return this;
  }

  /**
   * Ustawia własny nagłówek rozwijanej listy opcji.
   * @param headerContent Content Polymorpheus (string, TemplateRef lub komponent).
   */
  public setHeaderContent(headerContent: MaybeSignal<PolymorpheusContent<unknown> | undefined>): this {
    this._data.headerContent = headerContent;
    return this;
  }

  /**
   * Ustawia szablon HTML/Polymorpheus dla pojedynczej opcji w liście.
   * @param itemContent Szablon z kontekstem `{ $implicit: T }`.
   */
  public setItemContent(
    itemContent: MaybeSignal<PolymorpheusContent<{ $implicit: T }> | undefined>
  ): this {
    this._data.itemContent = itemContent;
    return this;
  }

  /**
   * Ustawia customowy komponent Angular renderujący pojedynczy element opcji.
   * Kompilator weryfikuje czy komponent przyjmuje input `item`.
   * @param component Klasa komponentu Angular z inputem `item`.
   */
  public setItemComponent(component: MaybeSignal<ErpSelectItemComponent<T> | undefined>): this {
    this._data.itemComponent = component;
    return this;
  }

  /**
   * Ustawia włączenie wirtualizacji (CDK Virtual Scroll) dla listy opcji.
   * @param virtualScroll Flaga włączająca wirtualizację.
   */
  public setVirtualScroll(virtualScroll: MaybeSignal<boolean>): this {
    this._data.virtualScroll = virtualScroll;
    return this;
  }

  /**
   * Ustawia wysokość opcji w pikselach dla wirtualizacji.
   * @param itemSize Wysokość w px (domyślnie 44).
   */
  public setItemSize(itemSize: MaybeSignal<number>): this {
    this._data.itemSize = itemSize;
    return this;
  }

  /**
   * Ustawia możliwość wyszukiwania/filtrowania opcji w liście.
   * @param searchable Czy pokazać pole wyszukiwania.
   */
  public setSearchable(searchable: MaybeSignal<boolean>): this {
    this._data.searchable = searchable;
    return this;
  }
}
