import { MaybeSignal } from '@erp/shared/ui';

export interface ErpFieldPanelTransition {
  id: string;

  /** Klucz tłumaczenia nazwy przejścia (`WorkflowTransitionDto.nameKey`) — dana schematu,
   * nie stała registry, tak samo jak nazwy stanów (`docs/modules/task-management/screens.md` §8). */
  labelKey: string;
}

export interface ErpFieldPanelOption {
  value: string;
  label: string;
}

/** Wiersz metadanych tylko do odczytu (przypisany, priorytet, termin…) — treść przychodzi
 * gotowa, bo rozwiązanie uuid→nazwisko i formatowanie daty zależy od kontekstu wywołującego. */
export interface ErpFieldPanelRow {
  labelKey: string;
  value: string;

  /** Kolorowa kropka przed wartością (priorytet, kategoria stanu…) — gotowy `background`
   * (najczęściej token `--tui-status-*`), panel nie zna znaczenia koloru. Wyklucza się
   * z `avatarUuid` — jeden wiersz ma co najwyżej jeden znacznik przed tekstem. */
  tone?: string;

  /** Awatar osoby przed wartością (przypisany, zgłaszający) zamiast kropki. */
  avatarUuid?: string;
}

/**
 * Prawy panel pól karty zgłoszenia (`docs/modules/task-management/screens.md` §9.1) — **stan
 * i dostępne przejścia na samej górze**, bo to najczęstsza akcja na karcie.
 *
 * <p>Pola niestandardowe budowane z profilu projektu (`IssueCustomFieldsComponent`) i tagi
 * (faza 6) nie mają tu własnego configu — wchodzą przez `<ng-content>`, żeby nie duplikować
 * reaktywnego formularza, który już istnieje w `feature`.</p>
 */
export interface ErpFieldPanelConfig {
  stateLabel: MaybeSignal<string>;

  /** Kolorowa kropka przed etykietą stanu — zwykle po kategorii stanu (`Todo`/`InProgress`/`Done`). */
  stateTone?: MaybeSignal<string>;

  transitions: MaybeSignal<readonly ErpFieldPanelTransition[]>;

  transitionsEnabled?: MaybeSignal<boolean>;

  /** Typ zgłoszenia — edytowalny tylko, gdy `typeOptions` jest podane. */
  typeValue?: MaybeSignal<string | undefined>;

  typeOptions?: MaybeSignal<readonly ErpFieldPanelOption[] | undefined>;

  typeEditable?: MaybeSignal<boolean>;

  rows: MaybeSignal<readonly ErpFieldPanelRow[]>;
}
