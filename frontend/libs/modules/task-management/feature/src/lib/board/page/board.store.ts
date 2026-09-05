import { Injectable, Signal, computed, inject, signal } from '@angular/core';

import { TranslocoService } from '@jsverse/transloco';

import { ErpOptimisticStore } from '@erp/shared/data-access';
import { ErpConfirmDialogService, ErpModalService, ErpToastService } from '@erp/shared/ui';
import {
  BoardCardVM,
  findMissingRequiredFieldCodes,
  BoardColumnDto,
  BoardSetCardPositionCommand,
  BoardSetSwimlaneCommand,
  IssueGraphService,
  IssueSetStateCommand,
  ProjectWorkflowService,
  TaskManagementBoardOrchestrator,
  TaskManagementIssueOrchestrator,
  openBlockersOf,
  openChildrenOf,
} from '@erp/task-management/data-access';
import {
  BOARD_SWIMLANE_MODE,
  BoardSwimlaneModeValue,
  ISSUE_PRIORITY,
  WORKFLOW_REQUIRED_FIELDS_MODAL_ID,
  WORKFLOW_STATE_CATEGORY,
} from '@erp/task-management/util';
import { TASKMANAGEMENT_KEYS } from '@erp/task-management/ui';

import { BOARD_KEYS } from '../translation';
import {
  WorkflowRequiredFieldsCommand,
  WorkflowRequiredFieldsMetadata,
} from '../../issue/modal/workflow-required-fields';

/** Wiersz grupowania (BRD-006) — kolumny wewnątrz swimlane'u to te same kolumny tablicy,
 * tylko z kartami zawężonymi do klucza tego wiersza. */
export interface SwimlaneVM {
  readonly key: string;
  readonly label: string;
  readonly columns: readonly BoardColumnVM[];
}

const UNASSIGNED_SWIMLANE_KEY = '__unassigned__';

/** Kolumna razem z kartami, które w niej leżą — model dla widoku, nie dla serwera. */
export interface BoardColumnVM {
  readonly uuid: string;
  readonly name: string;
  readonly stateUuids: readonly string[];
  readonly cards: readonly BoardCardVM[];
  /** Limit WIP (BRD-007) — sygnał wyłącznie wizualny, `undefined` znaczy „bez limitu". */
  readonly wipLimit: number | undefined;
}

/** Optymistyczne przesunięcie: karta narysowana tam, gdzie ją upuszczono, zanim serwer
 * potwierdzi. Trzymamy pozycję (kolumna + indeks), a NIE wyliczony rank — rank liczy serwer
 * (`docs/modules/task-management/domain.md` §7.2), więc front nie ma go po co udawać. */
interface PendingMove {
  readonly cardUuid: string;
  readonly swimlaneKey: string;
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
 * (`docs/modules/task-management/screens.md` §2.2): optymistyczne przestawienie z cofnięciem,
 * pomijanie własnego, jeszcze niepotwierdzonego ruchu i wygaszanie kolumn niedostępnych
 * <b>w chwili chwycenia karty</b> — a nie dopiero po upuszczeniu.</p>
 *
 * <p><b>Przesunięcie idzie przez `ErpOptimisticStore`</b> (`docs/guides/frontend/optimistic-updates.md`),
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
  private readonly _transloco = inject(TranslocoService);
  private readonly _graphService = inject(IssueGraphService);
  private readonly _confirm = inject(ErpConfirmDialogService);
  private readonly _modals = inject(ErpModalService);

  private readonly _draggedCardUuid = signal<string | null>(null);

  public readonly loading = signal<boolean>(true);

  public readonly board = this._boards.board;

  /** Karta chwycona w tej chwili — po niej liczą się kolumny dozwolone. */
  public readonly draggedCardUuid: Signal<string | null> = this._draggedCardUuid.asReadonly();

  /** Karta z własnym ruchem w toku (nakładka optymistyczna, jeszcze niepotwierdzona przez
   * serwer) — widok wygasza ją i blokuje drugie przeciągnięcie nad tym samym wierszem. */
  public readonly pendingCardUuid = computed<string | null>(() => {
    const board = this._boards.board();
    if (!board) {
      return null;
    }

    return this._optimistic.project<PendingMove>(BOARD_POSITION_SCOPE, board.uuid, undefined)?.cardUuid ?? null;
  });

  /**
   * Kolumny z kartami. Kolumna karty <b>wynika ze stanu zgłoszenia</b>, nie jest przechowywana
   * przy karcie — zduplikowanie jej dałoby dwa źródła prawdy, rozjeżdżające się przy każdej
   * zmianie stanu spoza tablicy (`docs/modules/task-management/domain.md` §7.1).
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
          wipLimit: column.wipLimit,
        };
      });
  });

  /**
   * Wiersze grupowania (BRD-006) nad tymi samymi kolumnami — bez drugiego mechanizmu ranku
   * (AC1): każdy wiersz to te same {@link columns}, tylko z kartami zawężonymi do jego klucza,
   * więc kolejność kart w obrębie wiersza to wciąż globalny `(rank, uuid)` kolumny.
   *
   * <p>Karta bez wartości grupującej (brak przypisanego, brak epiku, brak wartości pola) trafia
   * do jawnego wiersza „Bez przypisania" (AC2), nie znika. Bez skonfigurowanego grupowania
   * zwracany jest jeden wiersz bez nagłówka — komponent renderuje wtedy płaskie kolumny, jak
   * w fazie 2.</p>
   */
  public readonly swimlanes = computed<SwimlaneVM[]>(() => {
    const board = this._boards.board();
    const columns = this.columns();

    if (!board || board.swimlaneMode === BOARD_SWIMLANE_MODE.None) {
      return [{ key: UNASSIGNED_SWIMLANE_KEY, label: '', columns }];
    }

    // Grupowanie idzie od SUROWYCH kart, nie od `columns()`: nakładka optymistyczna musi
    // wstawić przesuwaną kartę do właściwego SWIMLANE'U i kolumny razem, jednym splice'em —
    // inaczej indeks upuszczenia (liczony przez CDK w obrębie listy JEDNEGO swimlane'u) trafiłby
    // w pozycję z listy złożonej ze wszystkich swimlane'ów naraz (§7.2, ale dla drugiego wymiaru).
    const mode = board.swimlaneMode as BoardSwimlaneModeValue;
    const cards = this._boards.cards();
    const pending = this._optimistic.project<PendingMove>(BOARD_POSITION_SCOPE, board.uuid, undefined);
    const moved = pending ? cards.find((card) => card.uuid === pending.cardUuid) : undefined;
    const keyOf = (card: BoardCardVM): string => this._swimlaneKeyOf(mode, card);

    const sortedColumns = [...board.columns].sort((left, right) => left.orderNo - right.orderNo);

    const keys = new Set<string>();
    for (const card of cards) {
      keys.add(keyOf(card));
    }

    if (keys.size === 0) {
      keys.add(UNASSIGNED_SWIMLANE_KEY);
    }

    return [...keys]
      .sort((a, b) => {
        if (a === UNASSIGNED_SWIMLANE_KEY) return 1;
        if (b === UNASSIGNED_SWIMLANE_KEY) return -1;
        return a.localeCompare(b);
      })
      .map((swimlaneKey) => ({
        key: swimlaneKey,
        label: this._swimlaneLabel(mode, swimlaneKey, cards),
        columns: sortedColumns.map((column) => {
          const own = cards.filter(
            (card) =>
              card.uuid !== moved?.uuid &&
              column.stateUuids.includes(card.stateUuid) &&
              keyOf(card) === swimlaneKey,
          );

          if (moved && pending?.swimlaneKey === swimlaneKey && pending?.columnUuid === column.uuid) {
            own.splice(Math.min(pending.index, own.length), 0, moved);
          }

          return {
            uuid: column.uuid,
            name: column.name,
            stateUuids: column.stateUuids,
            cards: own,
            wipLimit: column.wipLimit,
          };
        }),
      }));
  });

  /** Klucz grupowania karty — pusty/brakujący zawsze mapuje na jawny wiersz „Bez przypisania". */
  private _swimlaneKeyOf(mode: BoardSwimlaneModeValue, card: BoardCardVM): string {
    switch (mode) {
      case BOARD_SWIMLANE_MODE.Assignee:
        return card.assigneeUuid || UNASSIGNED_SWIMLANE_KEY;
      case BOARD_SWIMLANE_MODE.Epic:
        return card.parentUuid || UNASSIGNED_SWIMLANE_KEY;
      case BOARD_SWIMLANE_MODE.Priority:
        return String(card.priority);
      case BOARD_SWIMLANE_MODE.CustomField:
        return card.swimlaneFieldValue?.trim() || UNASSIGNED_SWIMLANE_KEY;
      default:
        return UNASSIGNED_SWIMLANE_KEY;
    }
  }

  private _swimlaneLabel(mode: BoardSwimlaneModeValue, key: string, cards: readonly BoardCardVM[]): string {
    if (key === UNASSIGNED_SWIMLANE_KEY) {
      return this._transloco.translate(BOARD_KEYS.swimlane.unassigned);
    }

    switch (mode) {
      case BOARD_SWIMLANE_MODE.Assignee: {
        const card = cards.find((c) => c.assigneeUuid === key);
        return card?.assignee?.displayName ?? key;
      }
      case BOARD_SWIMLANE_MODE.Epic: {
        const card = cards.find((c) => c.parentUuid === key);
        return card?.parentTitle ?? key;
      }
      case BOARD_SWIMLANE_MODE.Priority:
        return this._transloco.translate(this._priorityLabelKey(Number(key)));
      default:
        return key;
    }
  }

  private _priorityLabelKey(priority: number): string {
    switch (priority) {
      case ISSUE_PRIORITY.Critical:
        return TASKMANAGEMENT_KEYS.priority.critical;
      case ISSUE_PRIORITY.High:
        return TASKMANAGEMENT_KEYS.priority.high;
      case ISSUE_PRIORITY.Low:
        return TASKMANAGEMENT_KEYS.priority.low;
      case ISSUE_PRIORITY.Lowest:
        return TASKMANAGEMENT_KEYS.priority.lowest;
      default:
        return TASKMANAGEMENT_KEYS.priority.normal;
    }
  }

  /** Ustawia oś grupowania wierszy (BRD-006). */
  public setSwimlaneAsync(command: BoardSetSwimlaneCommand, queueId?: string): Promise<string> {
    return this._boards.setSwimlaneAsync(command, queueId);
  }

  /**
   * Kolumny, do których wolno upuścić chwyconą kartę.
   *
   * <p>Liczone <b>w chwili chwycenia</b>, ze schematu przejść projektu. Poznanie tego dopiero
   * z błędu po upuszczeniu jest wrogie użytkownikowi
   * (`docs/modules/task-management/screens.md` §2.2). To wygoda, nie kontrola — regułę
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
   * (`docs/modules/task-management/screens.md` §5). Zwraca uuid, żeby wywołujący mógł podmienić
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
  public async dropAsync(swimlaneKey: string, columnUuid: string, cardUuid: string, index: number): Promise<void> {
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

    // Sąsiedzi liczeni z aktualnego (jeszcze bez nakładki tego ruchu) stanu kolumny, W OBRĘBIE
    // tego samego swimlane'u (BRD-006 AC1) — sąsiad z innego wiersza grupowania nie jest
    // sąsiadem w sensie tej operacji, mimo że w globalnym łańcuchu ranku mógłby nim być.
    const { afterIssueUuid, beforeIssueUuid } = this._neighbours(swimlaneKey, columnUuid, cardUuid, index);
    const boardUuid = board.uuid;

    // Optymistyczna nakładka pozycji (`docs/guides/frontend/optimistic-updates.md`) — karta ląduje
    // w nowym miejscu natychmiast (patrz `columns` wyżej, projektujące ją z `ErpOptimisticStore`)
    // i schodzi dopiero, gdy `settleAsync` przeładuje tablicę z serwera: świeże dane są
    // jednocześnie potwierdzeniem i cofnięciem, zależnie od tego, czym skończyło się zadanie.
    await this._optimistic.runAsync<PendingMove>({
      scope: BOARD_POSITION_SCOPE,
      key: boardUuid,
      patch: () => ({ cardUuid, swimlaneKey, columnUuid, index }),
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
   * serwer z ich bieżących wartości, w transakcji (`docs/modules/task-management/domain.md` §7.2).
   */
  private _neighbours(
    swimlaneKey: string,
    columnUuid: string,
    cardUuid: string,
    index: number,
  ): { afterIssueUuid: string | undefined; beforeIssueUuid: string | undefined } {
    const swimlaneColumns = this.swimlanes().find((lane) => lane.key === swimlaneKey)?.columns ?? [];
    const cards = (swimlaneColumns.find((column) => column.uuid === columnUuid)?.cards ?? []).filter(
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

    // `resolution` (ISS-007) jest polem pierwszej klasy (`Issue.resolutionUuid`), nie pozycją
    // w `customFields` — dopisywany do tej samej mapy tylko po to, żeby jedna, wspólna funkcja
    // `findMissingRequiredFieldCodes` mogła sprawdzić oba rodzaje pól tym samym warunkiem.
    const fieldsWithResolution = { ...issue?.customFields, resolution: issue?.resolutionUuid ?? '' };
    const missing = findMissingRequiredFieldCodes(transition, fieldsWithResolution);
    if (missing.length === 0) {
      return true;
    }

    const ref = await this._modals.open<WorkflowRequiredFieldsCommand, WorkflowRequiredFieldsMetadata>(
      WORKFLOW_REQUIRED_FIELDS_MODAL_ID,
      {
        issueUuid,
        values: { ...issue?.customFields },
        resolutionUuid: issue?.resolutionUuid,
      } as WorkflowRequiredFieldsCommand,
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
