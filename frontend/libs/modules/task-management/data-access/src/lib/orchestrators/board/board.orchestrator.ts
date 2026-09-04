import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, map } from 'rxjs';

import {
  BaseOrchestrator,
  LoadOptions,
  OrchestratorConfig,
  ResolvedDeps,
  SignalrSyncService,
  UserDirectoryService,
} from '@erp/shared/data-access';
import { ErpUserRef } from '@erp/shared/util';
import { TASK_MANAGEMENT_JOB_COMMAND_KEYS } from '@erp/task-management/util';

import {
  BoardCardDto,
  BoardDto,
  BoardSetCardPositionCommand,
  BoardSetCardSprintCommand,
  BoardSetSwimlaneCommand,
  GetBoardCardsRequest,
  GetBoardRequest,
  SearchBoardRequest,
  SearchResponse,
  TaskManagementClient,
} from '../../api-client';
import { BoardCardVM } from './board.view-model';

/**
 * Orkiestrator tablicy — karty i ich kolejność.
 *
 * <p><b>Kluczem cache’u jest uuid KARTY, nie zgłoszenia.</b> Tak samo adresuje je kanał
 * `taskmgmt.board`, więc przeciągnięcie jednej karty odświeża jeden wiersz, a nie całą
 * tablicę (`docs/modules/task-management/domain.md` §7.4). Tym samym kanałem przychodzą uuid-y
 * tablicy (zmiana nazwy, układ kolumn) — nie ma ich w cache kart, więc `BaseOrchestrator`
 * po prostu je pomija.</p>
 *
 * <p><b>Orkiestrator jest związany z jedną otwartą tablicą</b> (`boardUuid`), inaczej niż
 * pozostałe w tym module. To wymuszony wyjątek: `getBoardCards` nie ma sensu bez tablicy,
 * a `fetchByUuids` z `BaseOrchestrator` dostaje wyłącznie uuid-y. Przełączenie tablicy
 * porzuca cache, bo karty starej nie mają już czego opisywać.</p>
 */
@Injectable({ providedIn: 'root' })
export class TaskManagementBoardOrchestrator extends BaseOrchestrator<
  BoardCardDto,
  BoardCardVM,
  GetBoardCardsRequest,
  LoadOptions
> {
  private readonly _api = inject(TaskManagementClient);
  private readonly _users = inject(UserDirectoryService);
  private readonly _boardSignalrSync = inject(SignalrSyncService);

  private readonly _boardUuid = signal<string | null>(null);
  private readonly _board = signal<BoardDto | null>(null);
  private readonly _cardUuids = signal<string[]>([]);

  protected override readonly signature = 'taskmgmt.board';

  protected override readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string } = {
    signalrSignature: 'taskmgmt.board',
    maxCacheSize: 2000,
  };

  public constructor() {
    super();

    // `_board` (nazwa/kolumny/swimlane) żyje POZA `identityMap` (ten trzyma karty, nie samą
    // tablicę), więc generyczne odświeżanie SignalR bazowej klasy go nie dotyka — druga
    // subskrypcja tego samego strumienia, filtrowana po uuid otwartej tablicy.
    this._boardSignalrSync
      .onUpdate('taskmgmt.board')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((uuids) => {
        const boardUuid = this._boardUuid();
        if (boardUuid && uuids.includes(boardUuid)) {
          void this._reloadBoardConfigAsync(boardUuid);
        }
      });
  }

  private async _reloadBoardConfigAsync(boardUuid: string): Promise<void> {
    const board = await this.runDirectCommandAsync(() => this._api.getBoard({ uuid: boardUuid } as GetBoardRequest));
    this._board.set(board);
  }

  /** Otwarta tablica razem z kolumnami — bez nich nie da się narysować ani jednej karty. */
  public readonly board: Signal<BoardDto | null> = this._board.asReadonly();

  /**
   * Karty w kolejności `(rank, uuid)` — dokładnie tej samej, którą liczy serwer.
   *
   * Karty bez ranku idą na koniec; to zgłoszenia, których nikt jeszcze nie przestawiał.
   */
  public readonly cards: Signal<BoardCardVM[]> = computed(() => {
    const viewModels = this.getViewModel()();

    return this._cardUuids()
      .map((uuid) => viewModels.get(uuid))
      .filter((card): card is BoardCardVM => card !== undefined)
      .sort(compareByPosition);
  });

  protected override fetchByUuids(uuids: string[]): Observable<BoardCardDto[]> {
    return this._api.getBoardCards({ boardUuid: this._boardUuid() ?? '', uuids } as GetBoardCardsRequest);
  }

  protected override searchByFilters(filters: GetBoardCardsRequest): Observable<SearchResponse> {
    return this._api
      .getBoardCards(filters)
      .pipe(map((cards) => ({ uuids: cards.map((card) => card.uuid), totalCount: cards.length }) as SearchResponse));
  }

  protected override mapToViewModel(dto: BoardCardDto, resolvedDeps: ResolvedDeps): BoardCardVM {
    return { ...dto, assignee: resolvedDeps['assignee'] as ErpUserRef | undefined };
  }

  protected override async resolveEagerDependencies(uuids: string[]): Promise<void> {
    const userUuids = new Set<string>();

    for (const uuid of uuids) {
      const assigneeUuid = this.identityMap.peek(uuid)?.assigneeUuid;

      if (assigneeUuid) {
        userUuids.add(assigneeUuid);
      }
    }

    if (userUuids.size > 0) {
      await this._users.loadAsync([...userUuids]);
    }
  }

  protected override _resolveCurrentDeps(dto: BoardCardDto): ResolvedDeps {
    return { assignee: this._users.getOne(dto.assigneeUuid)() };
  }

  /** Tablice widoczne dla użytkownika — do wyboru tablicy projektu. */
  public searchBoardsAsync(request: SearchBoardRequest): Promise<BoardDto[]> {
    return this.runDirectCommandAsync(() => this._api.searchBoard(request));
  }

  /**
   * Otwiera tablicę: pobiera jej kolumny i wszystkie karty.
   *
   * Karty wracają z `getBoardCards` w całości, więc trafiają do cache’u wprost — ponowne
   * pobranie tych samych danych po uuid byłoby drugą podróżą po to, co już przyszło.
   */
  public async openBoardAsync(boardUuid: string): Promise<BoardDto | null> {
    if (this._boardUuid() !== boardUuid) {
      this.identityMap.clear();
      this._cardUuids.set([]);
    }

    this._boardUuid.set(boardUuid);

    const board = await this.runDirectCommandAsync(() => this._api.getBoard({ uuid: boardUuid } as GetBoardRequest));
    this._board.set(board);

    await this.refreshCardsAsync();

    return board;
  }

  /** Przeładowuje wszystkie karty otwartej tablicy — po zmianie stanu zgłoszenia spoza
   * tablicy albo po masowej zmianie, która unieważniła sygnaturę. */
  public async refreshCardsAsync(): Promise<void> {
    const boardUuid = this._boardUuid();

    if (!boardUuid) {
      return;
    }

    const cards = await this.runDirectCommandAsync(() =>
      this._api.getBoardCards({ boardUuid } as GetBoardCardsRequest),
    );

    this.identityMap.setMany(cards);

    const uuids = cards.map((card) => card.uuid);
    this._cardUuids.set(uuids);

    // `{}` zamiast pominięcia opcji: `loadAsync` woła `resolveEagerDependencies` WYŁĄCZNIE,
    // gdy dostanie obiekt opcji — bez niego karty pokazałyby uuid zamiast nazwiska.
    await this.loadAsync(uuids, {});
  }

  /**
   * Przestawia kartę pomiędzy sąsiadów.
   *
   * <p><b>Komenda niesie sąsiadów, nie wyliczony rank</b> — rank liczy serwer, w transakcji,
   * z ich bieżących wartości (`docs/modules/task-management/domain.md` §7.2). Front, który liczyłby
   * go sam, wstawiałby kartę w miejsce widoczne u niego pół sekundy temu.</p>
   *
   * <p>Wywołujący odpowiada za optymistyczne przesunięcie karty i za jego cofnięcie, gdy
   * zadanie odpadnie — stąd zwracany `jobUuid`.</p>
   */
  public setCardPositionAsync(command: BoardSetCardPositionCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.boardSetCardPositionMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setBoardCardPosition,
      queueId,
    });
  }

  /** Przenosi kartę między backlogiem (`sprintUuid` puste) a sprintem — SPR-002. Sąsiedzi
   * i rank działają identycznie jak w {@link setCardPositionAsync}, tylko dla listy backlogu
   * albo sprintu zamiast kolumny kanbanowej. */
  public setCardSprintAsync(command: BoardSetCardSprintCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.boardSetCardSprintMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setBoardCardSprint,
      queueId,
    });
  }

  /** Ustawia oś grupowania wierszy (BRD-006). `board()` odświeży się sam, gdy zadanie się
   * wykona — patrz subskrypcja SignalR w konstruktorze. */
  public setSwimlaneAsync(command: BoardSetSwimlaneCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.boardSetSwimlaneMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setBoardSwimlane,
      queueId,
    });
  }
}

/**
 * Porządek kart: rank, a przy identycznym ranku — uuid.
 *
 * Para `(rank, uuid)` jest rozstrzygająca celowo i po obu stronach tak samo: dwie osoby
 * wstawiające kartę w to samo miejsce wyliczą <b>identyczny</b> rank i obie muszą zobaczyć
 * tę samą kolejność (`docs/modules/task-management/domain.md` §7.3). Porównanie musi być
 * leksykograficzne znak po znaku — stąd `<`/`>` na łańcuchach, nie `localeCompare`, które
 * ustawiłoby karty inaczej niż zestawienie `C` w Postgresie.
 */
function compareByPosition(left: BoardCardVM, right: BoardCardVM): number {
  if (!left.rank || !right.rank) {
    if (left.rank === right.rank) {
      return left.uuid < right.uuid ? -1 : left.uuid > right.uuid ? 1 : 0;
    }

    return left.rank ? -1 : 1;
  }

  if (left.rank !== right.rank) {
    return left.rank < right.rank ? -1 : 1;
  }

  return left.uuid < right.uuid ? -1 : left.uuid > right.uuid ? 1 : 0;
}
