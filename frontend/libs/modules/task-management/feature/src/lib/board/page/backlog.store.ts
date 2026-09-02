import { Injectable, Signal, computed, inject, signal } from '@angular/core';

import { JobService } from '@erp/shared/data-access';
import { ErpConfirmDialogService, ErpModalService, ErpToastService } from '@erp/shared/ui';
import {
  BoardCardVM,
  erpAwaitJobAsync,
  SprintCreateCommand,
  SprintExecCloseCommand,
  SprintVM,
  TaskManagementBoardOrchestrator,
  TaskManagementSprintOrchestrator,
} from '@erp/task-management/data-access';
import { SPRINT_CREATE_MODAL_ID, SPRINT_EXEC_CLOSE_MODAL_ID, SPRINT_STATUS } from '@erp/task-management/util';

import { BOARD_KEYS } from '../translation';
import { SprintExecCloseMetadata } from '../modal/sprint-exec-close/sprint-exec-close.definition';

/**
 * Stan podstrony backlogu — `/task-management/board/:uuid/backlog` (SPR-002).
 *
 * <p><b>Backlog i sprint dzielą ten sam mechanizm ranku, co kolumny tablicy kanbanowej</b>
 * (`docs/backend/task-management.md` §7.2, SPR-002 AC1): to wciąż jeden `board_card.rank`,
 * a "kolumna" to tutaj przynależność do sprintu (`BoardCardVM.sprintUuid`), nie stan zgłoszenia.
 * Stąd `BoardSetCardSprintCommand` zamiast `BoardSetCardPositionCommand` — ta sama logika
 * sąsiadów, inne pole, które się zmienia.</p>
 *
 * <p>Przesunięcie NIE idzie przez `ErpOptimisticStore` (jak na tablicy kanbanowej) — backlog
 * nie ma osobnych kolumn wygaszanych w locie ani modala pól wymaganych do obsłużenia w trakcie
 * przeciągania, więc prosty cykl „wyślij komendę → poczekaj na zadanie → odśwież" jest
 * wystarczający i nie dubluje maszynerii cofania (`docs/frontend/optimistic-updates.md`
 * — kiedy NIE stosować nakładki).</p>
 */
@Injectable()
export class BacklogStore {
  private readonly _boards = inject(TaskManagementBoardOrchestrator);
  private readonly _sprints = inject(TaskManagementSprintOrchestrator);
  private readonly _jobs = inject(JobService);
  private readonly _toast = inject(ErpToastService);
  private readonly _confirm = inject(ErpConfirmDialogService);
  private readonly _modals = inject(ErpModalService);

  private readonly _sprintUuids = signal<string[]>([]);

  public readonly loading = signal<boolean>(true);

  public readonly board = this._boards.board;

  /** Sprinty tej tablicy, planowany i zamknięte razem — w kolejności planu. */
  public readonly sprints: Signal<SprintVM[]> = computed(() => {
    const viewModels = this._sprints.getViewModel()();

    return this._sprintUuids()
      .map((uuid) => viewModels.get(uuid))
      .filter((sprint): sprint is SprintVM => sprint !== undefined)
      .sort((left, right) => (left.startsOn ?? '').toString().localeCompare((right.startsOn ?? '').toString()));
  });

  /** Sprint pokazywany obok backlogu — aktywny, a gdy żaden nie jest aktywny, pierwszy planowany.
   * Zamknięte sprinty nie mają tu miejsca: ich skład jest zamrożony (SPR-003 AC2). */
  public readonly currentSprint: Signal<SprintVM | null> = computed(() => {
    const sprints = this.sprints();

    return (
      sprints.find((sprint) => sprint.status === SPRINT_STATUS.Active) ??
      sprints.find((sprint) => sprint.status === SPRINT_STATUS.Planned) ??
      null
    );
  });

  /** Inne sprinty planowane tej tablicy — kandydaci do „przenieś niedokończone tutaj" przy
   * zamknięciu (SPR-003 AC1). */
  public readonly otherPlannedSprints: Signal<SprintVM[]> = computed(() =>
    this.sprints().filter(
      (sprint) => sprint.status === SPRINT_STATUS.Planned && sprint.uuid !== this.currentSprint()?.uuid,
    ),
  );

  public readonly backlogCards: Signal<BoardCardVM[]> = computed(() =>
    this._boards.cards().filter((card) => !card.sprintUuid),
  );

  public readonly sprintCards: Signal<BoardCardVM[]> = computed(() => {
    const current = this.currentSprint();

    return current ? this._boards.cards().filter((card) => card.sprintUuid === current.uuid) : [];
  });

  public async openAsync(boardUuid: string): Promise<void> {
    this.loading.set(true);

    try {
      await this._boards.openBoardAsync(boardUuid);
      await this._refreshSprintsAsync(boardUuid);
    } finally {
      this.loading.set(false);
    }
  }

  /** Przenosi kartę do backlogu (`sprintUuid` null) na wskazaną pozycję. */
  public dropToBacklogAsync(cardUuid: string, index: number): Promise<void> {
    return this._moveAsync(null, cardUuid, index);
  }

  /** Przenosi kartę do bieżącego sprintu na wskazaną pozycję. Bez skutku, gdy tablica nie ma
   * jeszcze żadnego sprintu — nie ma dokąd przenieść. */
  public dropToSprintAsync(cardUuid: string, index: number): Promise<void> {
    const current = this.currentSprint();

    return current ? this._moveAsync(current.uuid, cardUuid, index) : Promise.resolve();
  }

  private async _moveAsync(targetSprintUuid: string | null, cardUuid: string, index: number): Promise<void> {
    const board = this.board();
    const card = this._boards.cards().find((item) => item.uuid === cardUuid);

    if (!board || !card) {
      return;
    }

    // Sąsiedzi liczeni z listy DOCELOWEJ, po zdjęciu z niej przestawianej karty — tak samo jak
    // przy przeciąganiu na tablicy kanbanowej (`BoardStore._neighbours`).
    const targetList = (targetSprintUuid ? this.sprintCards() : this.backlogCards()).filter(
      (item) => item.uuid !== cardUuid,
    );

    try {
      const jobUuid = await this._boards.setCardSprintAsync({
        uuid: board.uuid,
        issueUuid: card.issueUuid,
        sprintUuid: targetSprintUuid ?? undefined,
        afterIssueUuid: targetList[index - 1]?.issueUuid,
        beforeIssueUuid: targetList[index]?.issueUuid,
      });

      await erpAwaitJobAsync(this._jobs, jobUuid);
    } catch {
      this._toast.show({ message: BOARD_KEYS.backlog.move.failed, appearance: 'negative' });
    } finally {
      await this._boards.refreshCardsAsync();
    }
  }

  /** Otwiera modal utworzenia sprintu na tej tablicy. */
  public async createSprintAsync(): Promise<void> {
    const board = this.board();

    if (!board) {
      return;
    }

    const ref = await this._modals.open<SprintCreateCommand, Record<string, never>>(
      SPRINT_CREATE_MODAL_ID,
      { uuid: crypto.randomUUID(), boardUuid: board.uuid } as SprintCreateCommand,
      {},
    );

    const { saved } = await ref.closed;

    if (saved) {
      await this._refreshSprintsAsync(board.uuid);
    }
  }

  /** Aktywuje sprint po potwierdzeniu — kolizja z drugim aktywnym sprintem tej samej tablicy
   * wraca jako błąd zadania (indeks bazy, SPR-001 AC1), nie coś, co front sprawdza z góry. */
  public async startSprintAsync(sprintUuid: string): Promise<void> {
    const confirmed = await this._confirm.confirmAsync({
      title: BOARD_KEYS.backlog.start.title,
      message: BOARD_KEYS.backlog.start.message,
      confirmLabel: BOARD_KEYS.backlog.start.confirm,
      appearance: 'warning',
    });

    if (!confirmed) {
      return;
    }

    const board = this.board();
    const jobUuid = await this._sprints.execStartMultipleAsync({ uuid: sprintUuid });
    await erpAwaitJobAsync(this._jobs, jobUuid);

    if (board) {
      await this._refreshSprintsAsync(board.uuid);
    }
  }

  /** Otwiera modal zamknięcia sprintu — jawna decyzja, dokąd trafiają niedokończone zgłoszenia
   * (SPR-003 AC1). */
  public async closeSprintAsync(sprintUuid: string): Promise<void> {
    const board = this.board();

    if (!board) {
      return;
    }

    const ref = await this._modals.open<SprintExecCloseCommand, SprintExecCloseMetadata>(
      SPRINT_EXEC_CLOSE_MODAL_ID,
      { uuid: sprintUuid } as SprintExecCloseCommand,
      { candidateSprints: this.otherPlannedSprints().map((sprint) => ({ uuid: sprint.uuid, name: sprint.name })) },
    );

    const { saved } = await ref.closed;

    if (saved) {
      await this._refreshSprintsAsync(board.uuid);
      await this._boards.refreshCardsAsync();
    }
  }

  private async _refreshSprintsAsync(boardUuid: string): Promise<void> {
    const sprints = await this._sprints.searchSprintsAsync({ boardUuid });
    this._sprintUuids.set(sprints.map((sprint) => sprint.uuid));
  }
}
