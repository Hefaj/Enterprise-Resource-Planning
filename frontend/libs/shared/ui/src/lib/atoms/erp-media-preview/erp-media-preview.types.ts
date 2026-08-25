import { MaybeSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpIcon } from '../../base/erp-icon.types';

/**
 * Jedna pozycja podglądu.
 *
 * <b>Nazwa pliku i podpis to DANE, nie klucze tłumaczeń</b> — idą do szablonu wprost, bez
 * `erpTranslate`. Przepuszczenie ich przez pipe skończyłoby się szukaniem klucza
 * `zdjecie-produktu.jpg` w słowniku. Przez klucze idzie wyłącznie chrom okna (przyciski,
 * komunikat o braku podglądu), i to on jest w `ErpMediaPreviewConfig`.
 */
export interface ErpMediaPreviewItem {
  /** Stabilny identyfikator — po nim wskazuje się pozycję startową. */
  readonly id: string;

  /** Nazwa pliku pokazywana w nagłówku. */
  readonly fileName: string;

  /** Wiersz pod nazwą — rozmiar, typ, produkt, cokolwiek opisuje pozycję. */
  readonly caption?: MaybeSignal<string | undefined>;

  /**
   * Adres do wyświetlenia.
   *
   * <b>Sygnał, a nie gotowy string</b>, bo zawartość jest za uprawnieniem i dojeżdża
   * asynchronicznie jako `blob:` (patrz `CatalogMultimediaContentService`). Okno otwiera się
   * natychmiast po dwukliku i samo dorysowuje obraz, gdy ten dojedzie — zamiast czekać
   * z otwarciem, aż plik się pobierze.
   *
   * `undefined` znaczy „jeszcze nie ma albo się nie uda" i daje spinner, potem komunikat.
   */
  readonly url: MaybeSignal<string | undefined>;

  /**
   * Czy pozycja jest obrazem możliwym do pokazania. Dla wideo, dokumentów i modeli 3D zostaje
   * ikona typu — okno nie udaje, że potrafi je wyrenderować.
   */
  readonly renderable?: boolean;

  /** Ikona zastępcza dla pozycji nierenderowalnych. */
  readonly icon?: ErpIcon;
}

export interface ErpMediaPreviewConfig {
  /** Komplet pozycji, po których da się przechodzić strzałkami. */
  items: MaybeSignal<readonly ErpMediaPreviewItem[]>;

  /**
   * Od której pozycji zacząć. Nieznane `id` (albo brak) otwiera pierwszą — okno nigdy nie
   * zostaje puste tylko dlatego, że wywołujący pomylił identyfikator.
   */
  startId?: string;

  /**
   * Pobranie oryginału oglądanej pozycji. <b>Bez tego pola przycisku nie ma</b> — podgląd
   * pokazuje wariant `preview`, a nie każdy wywołujący ma czym wydać plik źródłowy.
   */
  onDownload?: (item: ErpMediaPreviewItem) => void | Promise<void>;

  /** Komunikat dla pozycji, której nie da się pokazać. Domyślnie `shared.mediaPreview.unavailable`. */
  unavailableMessage?: MaybeSignal<Translatable>;
}
