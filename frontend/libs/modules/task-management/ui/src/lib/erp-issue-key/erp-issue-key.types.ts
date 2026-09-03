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

  /** Tytuł zgłoszenia — używany wyłącznie przy kopiowaniu linku (wzorem YouTrack: `DEV-1 Tytuł`,
   * gdzie klucz jest hiperłączem). Bez tytułu (np. w kontekstach, które go nie mają pod ręką)
   * kopiowany zostaje sam klucz jako link. */
  title?: MaybeSignal<string | undefined>;

  /** Trasa `routerLink`; brak — klucz renderuje się jako zwykły tekst (np. wewnątrz komórki,
   * która sama jest już linkiem). */
  link?: MaybeSignal<readonly unknown[] | undefined>;

  /** Pokazuje ikonę kopiowania linku do zgłoszenia (wzorem YouTrack) — domyślnie ukryta, bo
   * w tabeli/na kafelku klucz i tak jest linkiem klikalnym; ma sens tam, gdzie klucz nie jest
   * linkiem albo prowadzi donikąd (nagłówek karty zgłoszenia — już tam jesteśmy). */
  copyable?: MaybeSignal<boolean>;
}
