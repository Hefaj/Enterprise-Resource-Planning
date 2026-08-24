import { Injectable, signal } from '@angular/core';
import { SearchJobRequest } from '@erp/notification/data-access';

/**
 * Stan strony historii zadań — filtry wspólne dla panelu filtrów, zakładek i tabeli.
 *
 * Rejestrowany na komponencie strony (nie `providedIn: 'root'`), żeby żył dokładnie tyle
 * co widok — tak samo jak `ProductStore` w Catalogu. Store'a feedu (`JobService`) to NIE
 * zastępuje: tamten jest globalny i zasila dzwonek w shellu, ten opisuje jeden ekran.
 */
@Injectable()
export class JobStore {
  /**
   * Filtry zapytania `searchJob`.
   *
   * Startują puste. Zawężenie do zalogowanego użytkownika robi serwer (patrz `JobFeedService`
   * i `SearchJobEndpoint`), więc historia od razu pokazuje wszystkie własne zadania — także te
   * zlecone z innej przeglądarki. `clientId` zostaje w panelu jako opcjonalne zawężenie do
   * jednej karty, ale nie jest już wstępnie wypełniony.
   */
  public readonly filters = signal<Partial<SearchJobRequest>>({});

  public setFilters(newFilters: Partial<SearchJobRequest>): void {
    this.filters.set(newFilters);
  }

  public updateFilters(partial: Partial<SearchJobRequest>): void {
    this.filters.update(f => ({ ...f, ...partial }));
  }

  /** Stan ładowania tabeli — czyta go panel filtrów, żeby zablokować przycisk szukania. */
  public readonly loading = signal<boolean>(false);

  public setLoading(isLoading: boolean): void {
    this.loading.set(isLoading);
  }
}
