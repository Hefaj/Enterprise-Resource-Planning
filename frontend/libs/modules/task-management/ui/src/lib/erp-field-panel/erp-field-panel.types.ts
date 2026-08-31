import { MaybeSignal } from '@erp/shared/ui';

export interface ErpFieldPanelTransition {
  id: string;

  /** Klucz tłumaczenia nazwy przejścia (`WorkflowTransitionDto.nameKey`) — dana schematu,
   * nie stała registry, tak samo jak nazwy stanów (`docs/frontend/task-management-pages.md` §8). */
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
}

/**
 * Prawy panel pól karty zgłoszenia (`docs/frontend/task-management-pages.md` §9.1) — **stan
 * i dostępne przejścia na samej górze**, bo to najczęstsza akcja na karcie.
 *
 * <p>Pola niestandardowe budowane z profilu projektu (`IssueCustomFieldsComponent`) i tagi
 * (faza 6) nie mają tu własnego configu — wchodzą przez `<ng-content>`, żeby nie duplikować
 * reaktywnego formularza, który już istnieje w `feature`.</p>
 */
export interface ErpFieldPanelConfig {
  stateLabel: MaybeSignal<string>;

  transitions: MaybeSignal<readonly ErpFieldPanelTransition[]>;

  transitionsEnabled?: MaybeSignal<boolean>;

  /** Typ zgłoszenia — edytowalny tylko, gdy `typeOptions` jest podane. */
  typeValue?: MaybeSignal<string | undefined>;

  typeOptions?: MaybeSignal<readonly ErpFieldPanelOption[] | undefined>;

  typeEditable?: MaybeSignal<boolean>;

  rows: MaybeSignal<readonly ErpFieldPanelRow[]>;
}
