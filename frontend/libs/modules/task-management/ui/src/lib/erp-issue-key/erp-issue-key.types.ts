import { MaybeSignal } from '@erp/shared/ui';

/**
 * Klucz zgłoszenia + ikona typu — atom najczęściej powtarzany w module (`docs/frontend/
 * task-management-pages.md` §10): tabela, karta, powiązania i tablica pokazują to samo,
 * więc różnice w formacie klucza kończyłyby się jako cztery osobne poprawki.
 */
export interface ErpIssueKeyConfig {
  /** Klucz czytelny (`DEV-142`). */
  issueKey: MaybeSignal<string>;

  /** Ikona TaigaUI typu (`IssueType.icon`), np. `@tui.bug`. Brak ikony chowa ją całkiem —
   * miejsce puste zamiast domyślnej kropki byłoby myślące, że typ nie istnieje. */
  typeIcon?: MaybeSignal<string | undefined>;

  /** Nazwa typu — tylko do `title`/hover, klucz sam w sobie wystarcza na co dzień. */
  typeName?: MaybeSignal<string | undefined>;

  /** Trasa `routerLink`; brak — klucz renderuje się jako zwykły tekst (np. wewnątrz komórki,
   * która sama jest już linkiem). */
  link?: MaybeSignal<readonly unknown[] | undefined>;
}
