import { Injectable, Signal, computed, inject, signal } from '@angular/core';

import { ErpOptimisticStore } from '@erp/shared/data-access';
import { ErpConfirmDialogService, ErpModalService, ErpToastService } from '@erp/shared/ui';
import {
  BoardCardVM,
  findMissingRequiredFieldCodes,
  BoardColumnDto,
  BoardSetCardPositionCommand,
  IssueGraphService,
  IssueSetStateCommand,
  ProjectWorkflowService,
  TaskManagementBoardOrchestrator,
  TaskManagementIssueOrchestrator,
  openBlockersOf,
  openChildrenOf,
} from '@erp/task-management/data-access';
import { WORKFLOW_REQUIRED_FIELDS_MODAL_ID, WORKFLOW_STATE_CATEGORY } from '@erp/task-management/util';

import { BOARD_KEYS } from '../translation';
import {
  WorkflowRequiredFieldsCommand,
  WorkflowRequiredFieldsMetadata,
} from '../../issue/modal/workflow-required-fields';

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

/** Sygnatura pod którą nakładka pozycji tablicy żyje w `ErpOptimisticStore` — CELOWO różna od
 * `taskmgmt.board` (sygnatury cache’u kart orkiestratora): to nie jest patch na pojedynczej
 * karcie, tylko na „gdzie w kolumnie leży przeciągana karta”, więc ma własną przestrzeń kluczy. */
const BOARD_POSITION_SCOPE = 'taskmgmt.board.position';

/**
 * Stan strony tablicy.
 *
 * <p>Trzy rzeczy, których nie robi dziś żaden inny ekran w systemie
 * (`docs/frontend/task-management-pages.md` §2.2): optymistyczne przestawienie z cofnięciem,
 * pomijanie własnego, jeszcze niepotwierdzonego ruchu i wygaszanie kolumn niedostępnych
 * <b>w chwili chwycenia karty</b> — a nie dopiero po upuszczeniu.</p>
 *
 * <p><b>Przesunięcie idzie przez `ErpOptimisticStore`</b> (`docs/frontend/optimistic-updates.md`),
 * nie przez lokalny sygnał — daje to darmowy, spójny z resztą systemu cykl życia (cofnięcie,
 * toast, bezpiecznik czasowy), zamiast własnej kopii tej logiki tylko dla tablicy.</p>
 */
@Injectable()
export class BoardStore {
  private readonly _boards = inject(TaskManagementBoardOrchestrator);
  private readonly _issues = inject(TaskManagementIssueOrchestrator);
  private readonly _workflow = inject(ProjectWorkflowService);
  private readonly _optimistic = inject(ErpOptimisticStore);
  private readonly _toast = inject(ErpToastService);
  private readonly _graphService = inject(IssueGraphService);
  private readonly _confirm = inject(ErpConfirmDialogService);
  private readonly _modals = inject(ErpModalService);

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
    const pending = this._optimistic.project<PendingMove>(BOARD_POSITION_SCOPE, board.uuid, undefined);
    const moved = pending ? cards.find((card) => card.uuid === pending.cardUuid) : undefined;

    return [...board.columns]
      .sort((left, right) => left.orderNo - right.orderNo)
      .map((column) => {
        const own = cards.filter(
          (card) => card.uuid !== moved?.uuid && column.stateUuids.includes(card.stateUuid),
        );

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

    return new Set(
      board.columns
        .filter((column) => column.stateUuids.some((stateUuid) => reachable.has(stateUuid)))
        .map((column) => column.uuid),
    );
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

    const targetStateUuid = this._targetStateUuid(column, card.stateUuid);

    // `LNK-004`/`LNK-005` — ostrzeżenia grafu PRZED optymistycznym przesunięciem karty, nie po.
    // Anulowanie w oknie znaczy „karta nigdy się nie ruszyła" — dokładnie to samo, co `WF-004`
    // AC1 wymaga od modala pól wymaganych: cofnięcie ma zostawić kartę tam, gdzie była PRZED
    // przeciągnięciem, a najprostszy sposób na to jest nigdy nie rejestrować nakładki pozycji.
    if (targetStateUuid !== card.stateUuid) {
      const confirmed = await this._confirmGraphWarningsAsync(card.issueUuid, targetStateUuid);
      if (!confirmed) {
        return;
      }

      // WF-004 — modal otwiera się PRZED wykonaniem, dokładnie tak samo jak ostrzeżenia grafu
      // wyżej: żadna z dwóch bramek nie zarejestrowała jeszcze nakładki pozycji, więc anulowanie
      // którejkolwiek zostawia kartę dokładnie tam, gdzie była przed przeciągnięciem (AC1).
      const fieldsReady = await this._confirmRequiredFieldsAsync(
        board.projectUuid,
        card.issueUuid,
        card.stateUuid,
        targetStateUuid,
      );
      if (!fieldsReady) {
        return;
      }
    }

    // Sąsiedzi liczeni z aktualnego (jeszcze bez nakładki tego ruchu) stanu kolumny.
    const { afterIssueUuid, beforeIssueUuid } = this._neighbours(columnUuid, cardUuid, index);
    const boardUuid = board.uuid;

    // Optymistyczna nakładka pozycji (`docs/frontend/optimistic-updates.md`) — karta ląduje
    // w nowym miejscu natychmiast (patrz `columns` wyżej, projektujące ją z `ErpOptimisticStore`)
    // i schodzi dopiero, gdy `settleAsync` przeładuje tablicę z serwera: świeże dane są
    // jednocześnie potwierdzeniem i cofnięciem, zależnie od tego, czym skończyło się zadanie.
    await this._optimistic.runAsync<PendingMove>({
      scope: BOARD_POSITION_SCOPE,
      key: boardUuid,
      patch: () => ({ cardUuid, columnUuid, index }),
      dispatchAsync: async () => {
        if (targetStateUuid !== card.stateUuid) {
          // Pole nazywa się `stateUuid`, nie `toStateUuid` — wygenerowany interfejs ma indeks
          // `[key: string]: any`, więc literówka w nazwie NIE jest błędem kompilacji i dociera
          // do backendu jako pusty `Guid`. Stąd jawnie typowana zmienna zamiast rzutowania
          // obiektu literalnego.
          const setState: IssueSetStateCommand = { uuid: card.issueUuid, stateUuid: targetStateUuid };
          const stateJobUuid = await this._issues.setStateAsync(setState);

          // Dwie komendy pod JEDNĄ nakładką: pozycja ma sens tylko, gdy zmiana stanu się
          // powiodła (`taskmgmt.transition_not_allowed` i podobne odrzucenia domenowe idą przez
          // status zadania, nie przez 4xx) — stąd czekanie tutaj, zamiast wysyłać obie komendy
          // równolegle i liczyć na to, że druga też odpadnie.
          const stateJob = await this._optimistic.awaitJobAsync(stateJobUuid);

          if (!stateJob || stateJob.status !== 'completed' || stateJob.failedCount > 0) {
            throw new Error('taskmgmt.transition_not_allowed');
          }
        }

        const setPosition: BoardSetCardPositionCommand = {
          uuid: boardUuid,
          issueUuid: card.issueUuid,
          afterIssueUuid,
          beforeIssueUuid,
        };

        return this._boards.setCardPositionAsync(setPosition);
      },
      settleAsync: () => this._boards.refreshCardsAsync(),
      onRollback: () => this._toast.show({ message: BOARD_KEYS.move.failed, appearance: 'negative' }),
    });
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
  private _neighbours(
    columnUuid: string,
    cardUuid: string,
    index: number,
  ): { afterIssueUuid: string | undefined; beforeIssueUuid: string | undefined } {
    const cards = (this.columns().find((column) => column.uuid === columnUuid)?.cards ?? []).filter(
      (card) => card.uuid !== cardUuid,
    );

    return {
      afterIssueUuid: cards[index - 1]?.issueUuid,
      beforeIssueUuid: cards[index]?.issueUuid,
    };
  }

  /**
   * WF-004 — gdy przejście niesie `requiredFields`, a zgłoszeniu brakuje choć jednej z tych
   * wartości, otwiera modal zbierający TYLKO brakujące pola PRZED wysłaniem
   * `IssueSetStateCommand`. Zwraca `false`, gdy użytkownik anulował modal — dokładnie ten sam
   * kształt, co `_confirmGraphWarningsAsync`, więc `dropAsync` nie musi rozróżniać dwóch bramek.
   *
   * <p>Sprawdzenie jest wyłącznie frontowe (`findMissingRequiredFieldCodes`); backend ma ten
   * sam warunek jako backstop w `Issue.SetState` — patrz `taskmgmt.required_fields_missing`.</p>
   */
  private async _confirmRequiredFieldsAsync(
    projectUuid: string,
    issueUuid: string,
    fromStateUuid: string,
    toStateUuid: string,
  ): Promise<boolean> {
    const transition = this._workflow
      .transitionsFrom(projectUuid, fromStateUuid)()
      .find((item) => item.toStateUuid === toStateUuid);

    if (!transition || transition.requiredFields.length === 0) {
      return true;
    }

    // Karta na tablicy nie niesie pól niestandardowych (`BoardCardDto` — nagłówek, nie cała
    // encja), więc zgłoszenie musi dojechać osobno, zanim da się cokolwiek sprawdzić.
    await this._issues.loadAsync([issueUuid], {});
    const issue = this._issues.getOne(issueUuid)();

    const missing = findMissingRequiredFieldCodes(transition, issue?.customFields);
    if (missing.length === 0) {
      return true;
    }

    const ref = await this._modals.open<WorkflowRequiredFieldsCommand, WorkflowRequiredFieldsMetadata>(
      WORKFLOW_REQUIRED_FIELDS_MODAL_ID,
      { issueUuid, values: { ...issue?.customFields } } as WorkflowRequiredFieldsCommand,
      { projectUuid, missingFieldCodes: missing },
    );

    const { saved } = await ref.closed;
    return saved;
  }

  /**
   * `LNK-004`/`LNK-005` — te same dwa ostrzeżenia grafu, co na karcie zgłoszenia
   * (`IssueDetailComponent._confirmGraphWarningsAsync`), liczone wyłącznie na froncie: to
   * ostrzeżenie walidacyjne, backend go nie egzekwuje. Zwraca `false`, gdy użytkownik anulował
   * którekolwiek z okien — karta wtedy w ogóle nie rusza się z miejsca.
   */
  private async _confirmGraphWarningsAsync(issueUuid: string, toStateUuid: string): Promise<boolean> {
    const graph = this._graphService.getOne(issueUuid)() ?? (await this._graphService.loadAsync(issueUuid));

    const blockers = openBlockersOf(graph);
    if (blockers.length > 0) {
      const confirmed = await this._confirm.confirmAsync({
        title: BOARD_KEYS.warnings.blocked.title,
        message: BOARD_KEYS.warnings.blocked.message,
        confirmLabel: BOARD_KEYS.warnings.blocked.confirm,
        details: blockers.map((link) => `${link.otherKey} — ${link.otherTitle}`),
        appearance: 'warning',
      });

      if (!confirmed) {
        return false;
      }
    }

    const targetCategory = this._workflow
      .statesOf(this._boards.board()?.projectUuid)()
      .find((state) => state.uuid === toStateUuid)?.category;

    if (targetCategory === WORKFLOW_STATE_CATEGORY.Done) {
      const openChildren = openChildrenOf(graph);
      if (openChildren.length > 0) {
        const confirmed = await this._confirm.confirmAsync({
          title: BOARD_KEYS.warnings.openChildren.title,
          message: BOARD_KEYS.warnings.openChildren.message,
          confirmLabel: BOARD_KEYS.warnings.openChildren.confirm,
          details: openChildren.map((child) => `${child.key} — ${child.title}`),
          appearance: 'warning',
        });

        if (!confirmed) {
          return false;
        }
      }
    }

    return true;
  }
}
