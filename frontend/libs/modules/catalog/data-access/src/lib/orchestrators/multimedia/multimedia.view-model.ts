import { MultimediaDto } from '../../api-client';

/**
 * ViewModel zasobu multimedialnego.
 *
 * Wyrósł z aliasu na DTO w momencie, w którym backend zaczął zwracać pola sterujące
 * zachowaniem widoku, a nie tylko opisujące plik. Dwa takie pola są poniżej.
 *
 * `MultimediaDto` niesie sygnaturę indeksową (`[key: string]: any`), więc te pola dają się
 * odczytać z odpowiedzi jeszcze przed regeneracją klienta NSwag — patrz
 * `catalog-multimedia.orchestrator.ts`. Po regeneracji będą typowane u źródła i te dwa wpisy
 * staną się zwykłym powtórzeniem, do skasowania.
 */
export interface MultimediaVM extends MultimediaDto {
  /**
   * Czy w magazynie są już warianty pochodne (miniaturka, podgląd).
   *
   * Powstają asynchronicznie, po zatwierdzeniu transakcji, więc przez kilka sekund po wgraniu
   * jest tu `false`. **Wtedy komórka pokazuje ikonę typu, a nie sięga po oryginał** — pobranie
   * zdjęcia 4K (~6 MB) do kwadratu 40×40 jest dokładnie tym, czemu warianty zapobiegają.
   * Gotowość dociera zwykłym `AggregateChanged` na sygnaturze `catalog.multimedia`, więc widok
   * odświeża się sam, bez odpytywania w pętli.
   */
  hasDerivatives: boolean;

  /** Ile produktów używa tego zasobu. Niezerowa wartość blokuje usunięcie. */
  referenceCount: number;
}
