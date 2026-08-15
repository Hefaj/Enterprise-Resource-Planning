import { Injectable, signal } from '@angular/core';
import { getOrCreateClientId } from '@erp/shared/data-access';
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
   * `clientId` startuje na identyfikatorze tej karty przeglądarki, bo dopóki backend nie ma
   * uwierzytelniania, to jedyny adresat, jakiego zadanie faktycznie ma (patrz `JobFeedService`).
   * Pole jest jednak zwykłym filtrem — użytkownik może je w panelu podmienić i podejrzeć
   * zadania zlecone z innej karty.
   */
  public readonly filters = signal<Partial<SearchJobRequest>>({
    clientId: getOrCreateClientId(),
  });

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
