import { Injectable, signal } from '@angular/core';

/**
 * Współdzielony stan strony `/identity/permissions`: wyszukiwana fraza (filtr po lewej,
 * jak na pozostałych stronach modułu) i wybrany kod uprawnienia dla panelu "kto ma to
 * uprawnienie". Strona jest w 100% read-only (patrz plan implementacji §3.3) — ten store
 * istnieje głównie po to, żeby niezależne obszary siatki (`filter`/`content`/`rightPanel`,
 * wypełniane przez `ErpGridLayoutBuilder.fill()`, bez bezpośredniego połączenia input/output)
 * mogły się komunikować przez wspólny injector strony.
 */
@Injectable()
export class PermissionsStore {
  public readonly search = signal<string>('');
  public readonly selectedCode = signal<string | null>(null);

  public setSearch(search: string): void {
    this.search.set(search);
  }

  public selectPermission(code: string | null): void {
    this.selectedCode.set(code);
  }
}
