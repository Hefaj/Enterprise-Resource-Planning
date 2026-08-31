import { MaybeSignal } from '@erp/shared/ui';

/** Wiersz paska powiązań — rodzic, podzadanie albo krawędź grafu, już opisana etykietą
 * (klucz sentencji dobiera wywołujący, bo ta sama krawędź czyta się inaczej z każdej strony —
 * `IssueLinkDto.isOutgoing`). */
export interface ErpLinkListRow {
  uuid: string;

  key: string;

  title: string;

  /** Klucz tłumaczenia etykiety relacji („blokuje”, „blokowane przez”, „podzadanie”…). */
  relationKey: string;

  link: readonly unknown[];

  /** Stan celu, do wyszarzenia/oznaczenia — `undefined`, gdy wiersz nie ma sensu go pokazywać
   * (np. rodzic, dla którego karta już go nie renderuje). */
  stateNameKey?: string;

  /** Czy wolno odpiąć ten konkretny wiersz — rodzic ma osobny przycisk „odepnij”. */
  removable?: boolean;
}

export interface ErpLinkListTypeOption {
  value: number;
  label: string;
}

/**
 * Pasek powiązań (`docs/frontend/task-management-pages.md` §2.3, §9.1): rodzic, podzadania,
 * blokady i — od fazy 5 — zlecenie. Prezentacyjny: dane i opcje przychodzą gotowe, dodawanie
 * i usuwanie tylko emitują zdarzenia; komendy i rozwiązywanie klucza→uuid zostają w `feature`.
 */
export interface ErpLinkListConfig {
  parent: MaybeSignal<ErpLinkListRow | undefined>;

  children: MaybeSignal<readonly ErpLinkListRow[]>;

  links: MaybeSignal<readonly ErpLinkListRow[]>;

  linkTypeOptions: MaybeSignal<readonly ErpLinkListTypeOption[]>;

  saving?: MaybeSignal<boolean>;

  error?: MaybeSignal<string | undefined>;
}
