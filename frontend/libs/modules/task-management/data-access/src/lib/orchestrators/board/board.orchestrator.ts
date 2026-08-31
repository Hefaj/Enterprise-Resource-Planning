import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  BaseOrchestrator,
  LoadOptions,
  OrchestratorConfig,
  ResolvedDeps,
  UserDirectoryService,
} from '@erp/shared/data-access';
import { ErpUserRef } from '@erp/shared/util';
import { TASK_MANAGEMENT_JOB_COMMAND_KEYS } from '@erp/task-management/util';

import {
  BoardCardDto,
  BoardDto,
  BoardColumnInput,
  BoardCreateCommand,
  BoardSetCardPositionCommand,
  BoardSetColumnsCommand,
  BoardSetNameCommand,
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
 * tablicę (`docs/backend/task-management.md` §7.4). Tym samym kanałem przychodzą uuid-y
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

  private readonly _boardUuid = signal<string | null>(null);
  private readonly _board = signal<BoardDto | null>(null);
  private readonly _cardUuids = signal<string[]>([]);

  /**
   * Karty, dla których leci własna, jeszcze niepotwierdzona komenda.
   *
   * <p>Zamiennik pomijania echa po korelacji z §7.3: hub rozsyła dziś `(sygnatura, uuid-y)`
   * i <b>nie niesie `CorrelationId`</b>, więc front nie ma jak rozpoznać własnego zdarzenia
   * po stronie odbioru. Skutek jest ten sam — karta pod kursorem nie przeskakuje na echo
   * własnego ruchu — a kontrakt realtime zostaje nietknięty. Gdyby hub kiedyś zaczął nieść
   * korelację, to jest miejsce, które ma się wtedy zmienić.</p>
   */
  private readonly _pendingCardUuids = new Set<string>();

  protected override readonly signature = 'taskmgmt.board';

  protected override readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string } = {
    signalrSignature: 'taskmgmt.board',
    maxCacheSize: 2000,
  };

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
   * Zakłada tablicę projektu. Kolumny <b>nie przychodzą z żądania</b> — backend wyprowadza je
   * z bieżącego schematu stanów projektu, po jednej na stan
   * (`docs/backend/task-management.md` §7.1). Kształt kolumn zmienia się dopiero
   * <see cref="setColumnsAsync"/>.
   */
  public createBoardAsync(command: BoardCreateCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.boardCreateMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.createBoard,
      queueId,
    });
  }

  /** Nadpisuje nazwę tablicy. */
  public setBoardNameAsync(command: BoardSetNameCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.boardSetNameMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setBoardName,
      queueId,
    });
  }

  /**
   * Nadpisuje <b>całą</b> kolekcję kolumn.
   *
   * <p>Nie ma komendy „przenieś stan między kolumnami": między dwiema takimi operacjami tablica
   * byłaby w stanie, którego agregat zabrania (ten sam stan w dwóch kolumnach naraz), więc
   * układ idzie w całości.</p>
   */
  public setColumnsAsync(command: BoardSetColumnsCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.boardSetColumnsMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setBoardColumns,
      queueId,
    });
  }

  /**
   * Przestawia kartę pomiędzy sąsiadów.
   *
   * <p><b>Komenda niesie sąsiadów, nie wyliczony rank</b> — rank liczy serwer, w transakcji,
   * z ich bieżących wartości (`docs/backend/task-management.md` §7.2). Front, który liczyłby
   * go sam, wstawiałby kartę w miejsce widoczne u niego pół sekundy temu.</p>
   *
   * <p>Wywołujący odpowiada za optymistyczne przesunięcie karty i za jego cofnięcie, gdy
   * zadanie odpadnie — stąd zwracany `jobUuid`.</p>
   */
  public async setCardPositionAsync(
    cardUuid: string,
    command: BoardSetCardPositionCommand,
    queueId?: string,
  ): Promise<string> {
    this._pendingCardUuids.add(cardUuid);

    try {
      return await this.runSingleCommandAsync((p) => this._api.boardSetCardPositionMultipleCommand(p), command, {
        commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setBoardCardPosition,
        queueId,
      });
    } finally {
      this._pendingCardUuids.delete(cardUuid);
    }
  }

  /** Czy dla tej karty leci własna, jeszcze niepotwierdzona komenda — patrz
   * {@link _pendingCardUuids}. */
  public isPending(cardUuid: string): boolean {
    return this._pendingCardUuids.has(cardUuid);
  }

  /** Pomija odświeżenie SignalR dla karty, dla której leci własna, jeszcze niepotwierdzona
   * komenda — bez tego echo własnego ruchu przestawiałoby kartę pod kursorem w trakcie
   * przeciągania (§7.3). */
  protected override shouldSkipSignalRRefresh(cardUuid: string): boolean {
    return this.isPending(cardUuid);
  }
}

/**
 * Porządek kart: rank, a przy identycznym ranku — uuid.
 *
 * Para `(rank, uuid)` jest rozstrzygająca celowo i po obu stronach tak samo: dwie osoby
 * wstawiające kartę w to samo miejsce wyliczą <b>identyczny</b> rank i obie muszą zobaczyć
 * tę samą kolejność (`docs/backend/task-management.md` §7.3). Porównanie musi być
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
