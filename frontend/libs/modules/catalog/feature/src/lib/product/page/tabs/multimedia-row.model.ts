/**
 * Wiersz tabeli multimediów — referencja do pojedynczego pliku + produktu, do którego należy
 * (potrzebna, by pogrupować wiersze pod właściwym wierszem-rodzicem produktu).
 *
 * Celowo nie zawiera rozwiązanego `MultimediaVM` — pełna lista wierszy (i ich kolejność)
 * jest znana od razu z `ProductDto.multimediaUuids`, natomiast szczegóły (nazwa, miniaturka,
 * rozmiar...) doładowują się stopniowo w miarę scrollowania (patrz `onVisibleRowsChange`
 * w `multimedia-tab.component.ts`). Komórki komponentów same rozwiązują `MultimediaVM`
 * po `uuid` przez `CatalogMultimediaOrchestrator.getOne()`.
 */
export interface MultimediaRow {
  productUuid: string;
  uuid: string;
}
