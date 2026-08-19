import { Injectable, signal } from '@angular/core';
import { SearchUserAccountRequest } from '@erp/identity/data-access';

/**
 * Stan strony `/identity/users` — filtry listy i który wiersz jest aktualnie wybrany do
 * panelu szczegółów. Świadomie bez `ErpSelectionState`/scope zaznaczenia (patrz
 * `docs/frontend/selection-scope.md`) — to nie jest ekran z akcjami masowymi, tylko
 * pojedynczy wybór wiersza do podglądu/edycji, więc zwykły `uuid | null` wystarcza.
 */
@Injectable()
export class UsersStore {
  public readonly filters = signal<Partial<SearchUserAccountRequest>>({});
  public readonly loading = signal<boolean>(false);
  public readonly selectedUuid = signal<string | null>(null);

  public updateFilters(partial: Partial<SearchUserAccountRequest>): void {
    this.filters.update((f) => ({ ...f, ...partial }));
  }

  public setLoading(isLoading: boolean): void {
    this.loading.set(isLoading);
  }

  public selectUser(uuid: string | null): void {
    this.selectedUuid.set(uuid);
  }
}
