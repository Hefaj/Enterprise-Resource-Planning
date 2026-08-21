import { MaybeSignal, Translatable } from '@erp/shared/ui';

/**
 * Jeden wiersz roboczy — dokładnie tyle, ile potrzebuje `ProductCreateCommand`.
 *
 * `uuid` nadaje wywołujący (front), a nie backend: zakładanie produktów idzie trybem
 * `commands[]` kontraktu `BatchCommand`, w którym każda pozycja musi mieć własny
 * identyfikator agregatu, żeby raport zadania mógł mówić o pojedynczej pozycji.
 */
export interface ErpProductDraftRow {
  uuid: string;
  name: string;
  price: number | null;
}

/**
 * Konfiguracja edytora wierszy nowych produktów.
 *
 * Same klucze tłumaczeń i limity — komponent nie zna ani domeny, ani API. Wartość
 * (tablica wierszy) jedzie przez `FormControl` przekazany w `control`, tak samo jak
 * w atomach formularza z `@erp/shared/ui`.
 */
export interface ErpProductDraftRowsConfig {
  /** Etykieta i placeholder kolumny z nazwą produktu. */
  nameLabel: MaybeSignal<Translatable>;
  namePlaceholder?: MaybeSignal<Translatable | undefined>;

  /** Etykieta i placeholder kolumny z ceną. */
  priceLabel: MaybeSignal<Translatable>;
  pricePlaceholder?: MaybeSignal<Translatable | undefined>;

  /** Komunikaty walidacji pojedynczego wiersza. */
  nameRequiredError?: MaybeSignal<Translatable | undefined>;
  priceRequiredError?: MaybeSignal<Translatable | undefined>;
  priceMinError?: MaybeSignal<Translatable | undefined>;

  /** Etykiety akcji: dodanie wiersza i usunięcie pojedynczego wiersza. */
  addRowLabel: MaybeSignal<Translatable>;
  removeRowLabel: MaybeSignal<Translatable>;

  /** Górny limit wierszy w jednym wsadzie; bez wartości — bez limitu. */
  maxRows?: MaybeSignal<number | undefined>;

  /** Generator identyfikatorów nowych wierszy. Domyślnie `crypto.randomUUID()`. */
  newUuid?: () => string;
}
