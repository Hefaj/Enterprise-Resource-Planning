import { TemplateRef } from '@angular/core';

import { MaybeSignal } from '@erp/shared/ui';

/** Kategoria wpisu do zaznaczenia w filtrze — wielokrotny wybór (`docs/frontend/task-management-pages.md`
 * §9.1), bez osobnej opcji „Wszystko": brak zaznaczenia znaczy „bez filtra", czyli to samo, co
 * zaznaczenie wszystkich kategorii naraz. `Czas` istnieje już teraz (kolumna filtra), mimo że
 * rejestracja czasu wchodzi dopiero w fazie 6; filtr po prostu nie pokazuje w tej kategorii nic,
 * dopóki jej nie ma. */
export type ErpActivityStreamFilter = 'comments' | 'history' | 'time';

interface ErpActivityStreamEntryBase {
  uuid: string;
  actorUuid: string;
  occurredAt: Date;

  /** Efekt reguły automatyzacji (faza 8, AUT-001 AC2), nie zmiana użytkownika — front pokazuje
   * znacznik zamiast awatara aktora, bo `actorUuid` jest wtedy pusty (skan/reguła nie ma
   * sprawcy-człowieka). */
  isAutomated?: boolean;
}

export interface ErpActivityCommentEntry extends ErpActivityStreamEntryBase {
  kind: 'comment';
  /** HTML już gotowy do wyświetlenia (ten sam `erp-rich-text` w trybie `readOnly`, co przy
   * zapisie — formatowanie zgadza się z tym, co widział piszący). */
  bodyHtml: string;
  isRemoved: boolean;
  editedAt: Date | undefined;
  isAuthor: boolean;
  /** `undefined` dla komentarza głównego — wątek jest jednopoziomowy (`task-management.md` §11),
   * więc to jedyny poziom zagnieżdżenia, jaki w ogóle istnieje. */
  parentUuid: string | undefined;
}

export interface ErpActivityHistoryEntry extends ErpActivityStreamEntryBase {
  kind: 'history';
  /** Klucz zdania — `params.field` (jeśli jest) MUSI już być przetłumaczony przez wywołującego
   * PRZED przekazaniem tutaj: Transloco nie rozwiązuje kluczy zagnieżdżonych w parametrach
   * (`docs/frontend/task-management-pages.md` §2.3). */
  sentenceKey: string;
  params?: Record<string, string>;
}

export interface ErpActivityTimeEntry extends ErpActivityStreamEntryBase {
  kind: 'time';
  sentenceKey: string;
  params?: Record<string, string>;
}

export type ErpActivityStreamEntry = ErpActivityCommentEntry | ErpActivityHistoryEntry | ErpActivityTimeEntry;

/**
 * Strumień aktywności karty zgłoszenia — komentarze, historia i (od fazy 6) czas w jednej,
 * chronologicznej liście z filtrem (`docs/frontend/task-management-pages.md` §9.1, decyzja 2).
 *
 * <p><b>Prezentacyjny z hakami na własny UI wywołującego</b>: edytor odpowiedzi/edycji komentarza
 * zna `erp-rich-text` i orkiestrator, których ten atom nie ma prawa znać, więc oba miejsca
 * (stopka-kompozytor i „dodatek" pod wpisem, np. formularz edycji) renderują się z szablonów
 * podanych przez `feature` — atom tylko decyduje, KIEDY je pokazać.</p>
 */
export interface ErpActivityStreamConfig {
  entries: MaybeSignal<readonly ErpActivityStreamEntry[]>;

  /** Uuid wpisu, pod którym ma się pojawić `entryExtraTemplate` (odpowiedź/edycja w toku). */
  expandedUuid?: MaybeSignal<string | undefined>;

  canWrite?: MaybeSignal<boolean>;

  /** Zakotwiczony na dole strumienia (`docs/frontend/task-management-pages.md` §9.1,
   * decyzja 3) — pole nowego komentarza + przycisk zapisu, własność `feature`. */
  composerTemplate?: TemplateRef<void>;

  /** Renderowany pod wpisem wskazanym przez `expandedUuid` — formularz odpowiedzi albo edycji,
   * zależnie od tego, co `feature` aktualnie otworzył. Kontekst niesie sam wpis. */
  entryExtraTemplate?: TemplateRef<{ $implicit: ErpActivityStreamEntry }>;
}
