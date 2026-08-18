import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpSelectionScope } from '../erp-table/erp-selection.utils';

/**
 * Konfiguracja banera zasięgu zaznaczenia — „zdania o zasięgu", które musi być widoczne
 * nad panelem zależnym od zaznaczenia, zanim użytkownik kliknie akcję masową.
 *
 * Baner renderuje się tylko wtedy, gdy zasięg wymaga wyjaśnienia:
 * - `query` → podgląd (próbka) + informacja, że akcje obejmą cały zbiór z filtra,
 * - `explicit` po materializacji → spokojne potwierdzenie „zaznaczono wszystkie N".
 *
 * Przy zwykłym, ręcznym zaznaczeniu i przy braku zaznaczenia baner nie pokazuje nic —
 * użytkownik widzi dokładnie to, czego dotyczy operacja, więc nie ma czego tłumaczyć.
 */
export interface ErpSelectionScopeBannerConfig {
  /** Zasięg zaznaczenia (zwykle `scope` ze store'u strony). */
  scope: MaybeSignal<ErpSelectionScope<any, any>>;
  /** Ile pozycji faktycznie widać w panelu — liczba do zdania „Podgląd X z Y". */
  shownCount?: MaybeSignal<number>;
  /** Nagłówek trybu `query`. Parametry: `{ shown, count }`. */
  previewTitle?: MaybeSignal<Translatable>;
  /** Opis pod nagłówkiem trybu `query` (`null`/pominięte = bez opisu). */
  previewDescription?: MaybeSignal<Translatable>;
  /** Komunikat po materializacji „Zaznacz wszystko". Parametry: `{ count }`. */
  allTitle?: MaybeSignal<Translatable>;
  /** Czy pokazywać komunikat po materializacji. Domyślnie `true`. */
  showMaterialized?: MaybeSignal<boolean>;
}
