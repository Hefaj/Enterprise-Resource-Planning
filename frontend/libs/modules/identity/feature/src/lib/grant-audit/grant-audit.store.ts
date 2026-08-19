import { Injectable, signal } from '@angular/core';
import { SearchGrantAuditRequest } from '@erp/identity/data-access';

/**
 * Stan strony historii nadań — wyłącznie filtry i status ładowania. Dziennik audytu jest
 * append-only i wyłącznie do odczytu (bez komend, bez zaznaczeń/akcji masowych), więc store
 * jest świadomie dużo prostszy niż `ProductStore` w Catalog (patrz `docs/frontend/selection-scope.md`
 * — tu nie ma czego zaznaczać).
 */
@Injectable() // Rejestrowany na poziomie komponentu strony, żyje tylko tyle co widok
export class GrantAuditStore {
  public readonly filters = signal<Partial<SearchGrantAuditRequest>>({});

  public readonly loading = signal<boolean>(false);

  public setFilters(newFilters: Partial<SearchGrantAuditRequest>): void {
    this.filters.set(newFilters);
  }

  public updateFilters(partial: Partial<SearchGrantAuditRequest>): void {
    this.filters.update((f) => ({ ...f, ...partial }));
  }

  public setLoading(isLoading: boolean): void {
    this.loading.set(isLoading);
  }
}
