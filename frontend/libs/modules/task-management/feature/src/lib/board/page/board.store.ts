import { Injectable, Signal, computed, inject, signal } from '@angular/core';

import { JobService } from '@erp/shared/data-access';
import { ErpModalService, ErpToastService } from '@erp/shared/ui';
import {
  BoardCardVM,
  erpAwaitJobAsync,
  BoardColumnDto,
  BoardSetCardPositionCommand,
  IssueSetStateCommand,
  ProjectWorkflowService,
  ProjectFieldProfileService,
  TaskManagementBoardOrchestrator,
  TaskManagementIssueOrchestrator,
} from '@erp/task-management/data-access';
import { ISSUE_SET_STATE_MODAL_ID } from '@erp/task-management/util';

import { BOARD_KEYS } from '../translation';

/** Kolumna razem z kartami, które w niej leżą — model dla widoku, nie dla serwera. */
export interface BoardColumnVM {
  readonly uuid: string;
  readonly name: string;
  readonly stateUuids: readonly string[];
  readonly cards: readonly BoardCardVM[];
}

/** Optymistyczne przesunięcie: karta narysowana tam, gdzie ją upuszczono, zanim serwer
 * potwierdzi. Trzymamy pozycję (kolumna + indeks), a NIE wyliczony rank — rank liczy serwer
 * (`docs/backend/task-management.md` §7.2), więc front nie ma go po co udawać. */
interface PendingMove {
  readonly cardUuid: string;
  readonly columnUuid: string;
  readonly index: number;
}

/**
 * Stan strony tablicy.
 *
 * <p>Trzy rzeczy, których nie robi dziś żaden inny ekran w systemie
 * (`docs/frontend/task-management-pages.md` §2.2): optymistyczne przestawienie z cofnięciem,
 * pomijanie własnego, jeszcze niepotwierdzonego ruchu i wygaszanie kolumn niedostępnych
 * <b>w chwili chwycenia karty</b> — a nie dopiero po upuszczeniu.</p>
 */
@Injectable()
export class BoardStore {
  private readonly _boards = inject(TaskManagementBoardOrchestrator);
  private readonly _issues = inject(TaskManagementIssueOrchestrator);
  private readonly _workflow = inject(ProjectWorkflowService);
  private readonly _jobs = inject(JobService);
  private readonly _toast = inject(ErpToastService);
  private readonly _modals = inject(ErpModalService);
  private readonly _fields = inject(ProjectFieldProfileService);

  private readonly _pendingMove = signal<PendingMove | null>(null);
  private readonly _draggedCardUuid = signal<string | null>(null);

  public readonly loading = signal<boolean>(true);

  public readonly board = this._boards.board;

  /** Karta chwycona w tej chwili — po niej liczą się kolumny dozwolone. */
  public readonly draggedCardUuid: Signal<string | null> = this._draggedCardUuid.asReadonly();

  /**
   * Kolumny z kartami. Kolumna karty <b>wynika ze stanu zgłoszenia</b>, nie jest przechowywana
   * przy karcie — zduplikowanie jej dałoby dwa źródła prawdy, rozjeżdżające się przy każdej
   * zmianie stanu spoza tablicy (`docs/backend/task-management.md` §7.1).
   *
   * <p>Zgłoszenie w stanie nieprzypisanym do żadnej kolumny <b>znika z tablicy</b> i to jest
   * poprawne: tak działa kolumna „gotowe" schowana za filtrem.</p>
   */
  public readonly columns = computed<BoardColumnVM[]>(() => {
    const board = this._boards.board();

    if (!board) {
      return [];
    }

    const cards = this._boards.cards();
    const pending = this._pendingMove();
    const moved = pending ? cards.find((card) => card.uuid === pending.cardUuid) : undefined;

    return [...board.columns]
      .sort((left, right) => left.orderNo - right.orderNo)
      .map((column) => {
        const own = cards.filter((card) => card.uuid !== moved?.uuid && column.stateUuids.includes(card.stateUuid));

        if (moved && pending?.columnUuid === column.uuid) {
          own.splice(Math.min(pending.index, own.length), 0, moved);
        }

        return {
          uuid: column.uuid,
          name: column.name,
          stateUuids: column.stateUuids,
          cards: own,
        };
      });
  });

  /**
   * Kolumny, do których wolno upuścić chwyconą kartę.
   *
   * <p>Liczone <b>w chwili chwycenia</b>, ze schematu przejść projektu. Poznanie tego dopiero
   * z błędu po upuszczeniu jest wrogie użytkownikowi
   * (`docs/frontend/task-management-pages.md` §2.2). To wygoda, nie kontrola — regułę
   * i tak egzekwuje backend (`taskmgmt.transition_not_allowed`).</p>
   */
  public readonly allowedColumnUuids = computed<ReadonlySet<string>>(() => {
    const board = this._boards.board();
    const cardUuid = this._draggedCardUuid();

    if (!board || !cardUuid) {
      return new Set(board?.columns.map((column) => column.uuid) ?? []);
    }

    const card = this._boards.cards().find((item) => item.uuid === cardUuid);

    if (!card) {
      return new Set<string>();
    }

    const reachable = new Set(
      this._workflow
        .transitionsFrom(board.projectUuid, card.stateUuid)()
        .map((transition) => transition.toStateUuid),
    );

    // Kolumna, w której karta już leży, zostaje dostępna — przestawienie w pionie nie jest
    // przejściem stanu i nie ma go w schemacie.
    reachable.add(card.stateUuid);

    return new Set(board.columns.filter((column) => column.stateUuids.some((stateUuid) => reachable.has(stateUuid))).map((column) => column.uuid));
  });

  /**
   * Domyślna tablica użytkownika — pierwsza oznaczona jako domyślna wśród widocznych.
   *
   * <p>Istnieje, bo pozycja w menu nie ma skąd wziąć uuid-a tablicy, a osobna strona „lista
   * tablic” dla jednej tablicy na projekt byłaby klikiem donikąd
   * (`docs/frontend/task-management-pages.md` §5). Zwraca uuid, żeby wywołujący mógł podmienić
   * adres na konkretną tablicę — link do „jakiejś domyślnej” nie da się wysłać koledze.</p>
   */
  public async resolveDefaultBoardUuidAsync(): Promise<string | null> {
    const boards = await this._boards.searchBoardsAsync({});

    return boards.find((board) => board.isDefault)?.uuid ?? boards[0]?.uuid ?? null;
  }

  public async openAsync(boardUuid: string): Promise<void> {
    this.loading.set(true);

    try {
      const board = await this._boards.openBoardAsync(boardUuid);

      if (board) {
        // Schemat stanów jest potrzebny do wygaszania kolumn przy chwyceniu karty, więc
        // dociągamy go razem z tablicą, a nie dopiero przy pierwszym przeciągnięciu.
        await this._workflow.loadAsync(board.projectUuid);
      }
    } finally {
      this.loading.set(false);
    }
  }

  public startDrag(cardUuid: string): void {
    this._draggedCardUuid.set(cardUuid);
  }

  public endDrag(): void {
    this._draggedCardUuid.set(null);
  }

  /**
   * Upuszczenie karty w kolumnie na wskazanej pozycji.
   *
   * <p>Kolejność operacji jest wymuszona przez model: <b>najpierw stan, potem pozycja</b>.
   * Kolumna wynika ze stanu, więc przeciągnięcie w bok to zwykła zmiana stanu zgłoszenia,
   * a przeciągnięcie w pionie — przestawienie karty. Jedna komenda robiąca oba naraz
   * dawałaby drugie źródło prawdy o kolumnie.</p>
   */
  public async dropAsync(columnUuid: string, cardUuid: string, index: number): Promise<void> {
    const board = this._boards.board();
    const card = this._boards.cards().find((item) => item.uuid === cardUuid);
    const column = board?.columns.find((item) => item.uuid === columnUuid);

    if (!board || !card || !column) {
      return;
    }

    // Optymistyczne przesunięcie: karta ląduje w nowym miejscu natychmiast. Zdejmujemy je
    // dopiero, gdy tablica przyjdzie z serwera — świeże dane są jednocześnie potwierdzeniem
    // i cofnięciem, zależnie od tego, czym skończyło się zadanie.
    this._pendingMove.set({ cardUuid, columnUuid, index });

    const targetStateUuid = this._targetStateUuid(column, card.stateUuid);
    const { afterIssueUuid, beforeIssueUuid } = this._neighbours(columnUuid, cardUuid, index);

    try {
      if (targetStateUuid !== card.stateUuid) {
        const transition = this._workflow
          .transitionsFrom(board.projectUuid, card.stateUuid)()
          .find((item) => item.toStateUuid === targetStateUuid);
        const requiredCodes = transition?.requiredFieldCodes ?? [];
        if (requiredCodes.length > 0) {
          const profile = await this._fields.loadAsync(board.projectUuid);
          const requiredFields = profile?.fields.filter((field) => requiredCodes.includes(field.code)) ?? [];
          const modal = await this._modals.open(
            ISSUE_SET_STATE_MODAL_ID,
            {
              targetUuids: [card.issueUuid],
              templateCommand: { stateUuid: targetStateUuid },
            },
            { targetCount: 1, projectUuid: board.projectUuid, requiredFields },
          );
          const result = await modal.closed;
          if (!result.saved) return;
          await this._runAsync(Promise.resolve(result.result as string));
        } else {
          // Pole nazywa się `stateUuid`, nie `toStateUuid` — wygenerowany interfejs ma indeks
          // `[key: string]: any`, więc literówka w nazwie NIE jest błędem kompilacji i dociera
          // do backendu jako pusty `Guid`. Stąd jawnie typowana zmienna zamiast rzutowania
          // obiektu literalnego.
          const setState: IssueSetStateCommand = { uuid: card.issueUuid, stateUuid: targetStateUuid };

          await this._runAsync(this._issues.setStateAsync(setState));
        }
      }

      const setPosition: BoardSetCardPositionCommand = {
        uuid: board.uuid,
        issueUuid: card.issueUuid,
        afterIssueUuid,
        beforeIssueUuid,
      };

      await this._runAsync(this._boards.setCardPositionAsync(cardUuid, setPosition));
    } catch {
      this._toast.show({ message: BOARD_KEYS.move.failed, appearance: 'negative' });
    } finally {
      await this._boards.refreshCardsAsync();
      this._pendingMove.set(null);
    }
  }

  /** Stan, w który wpada karta upuszczona w tej kolumnie. Kolumna może zbierać kilka stanów —
   * karta zostaje w swoim, jeśli kolumna go obsługuje, inaczej dostaje pierwszy z listy. */
  private _targetStateUuid(column: BoardColumnDto, currentStateUuid: string): string {
    return column.stateUuids.includes(currentStateUuid) ? currentStateUuid : column.stateUuids[0];
  }

  /**
   * Sąsiedzi karty po upuszczeniu — liczeni z widoku kolumny, po zdjęciu z niej przestawianej
   * karty. Do serwera idą <b>identyfikatory sąsiadów, nigdy wyliczony rank</b>: rank liczy
   * serwer z ich bieżących wartości, w transakcji (`docs/backend/task-management.md` §7.2).
   */
  private _neighbours(columnUuid: string, cardUuid: string, index: number): { afterIssueUuid: string | undefined; beforeIssueUuid: string | undefined } {
    const cards = (this.columns().find((column) => column.uuid === columnUuid)?.cards ?? []).filter((card) => card.uuid !== cardUuid);

    return {
      afterIssueUuid: cards[index - 1]?.issueUuid,
      beforeIssueUuid: cards[index]?.issueUuid,
    };
  }

  /**
   * Czekanie na zadanie mieszka w `erpAwaitJobAsync` — ten sam obrys obowiązuje pasek powiązań
   * na karcie zgłoszenia, więc nie ma po co trzymać dwóch kopii.
   */
  private _runAsync(command: Promise<string>): Promise<void> {
    return command.then((jobUuid) => erpAwaitJobAsync(this._jobs, jobUuid));
  }
}
