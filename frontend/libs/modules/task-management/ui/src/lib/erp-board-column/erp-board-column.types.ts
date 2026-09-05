import { ErpIssueCardConfig } from '../erp-issue-card';

/** Karta renderowana w kolumnie. Kolejność i dozwolone przejścia ustala warstwa feature. */
export interface ErpBoardColumnCard {
  readonly uuid: string;
  readonly card: ErpIssueCardConfig;
}

/** Prezentacyjny kontrakt kolumny tablicy. Nie zależy od DTO ani store'a modułu. */
export interface ErpBoardColumnConfig {
  readonly uuid: string;
  readonly name: string;
  readonly cards: readonly ErpBoardColumnCard[];
  readonly enabled: boolean;
  /** Backlog używa tej samej listy, lecz rozciąga ją na połowę dostępnej szerokości. */
  readonly fillAvailableWidth?: boolean;
  readonly wipLimit?: number;
  readonly countLabelKey: string;
  readonly wipExceededLabelKey: string;
  readonly emptyLabelKey: string;
  /** Etykieta dostępności karty — klawiaturowa alternatywa przeciągania (strzałki lewo/prawo
   * przenoszą do sąsiedniej kolumny) nie ma odpowiednika wizualnego, więc musi być w `aria-label`. */
  readonly cardKeyboardHintKey: string;
}
