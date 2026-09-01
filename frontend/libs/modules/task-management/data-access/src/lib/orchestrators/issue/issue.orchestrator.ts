import { Injectable, Injector, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  BaseOrchestrator,
  LoadOptions,
  OrchestratorConfig,
  ResolvedDeps,
  Translatable,
  UserDirectoryService,
} from '@erp/shared/data-access';
import { ErpUserRef } from '@erp/shared/util';
import { TASK_MANAGEMENT_JOB_COMMAND_KEYS } from '@erp/task-management/util';

import {
  BatchCommandOfIssueSetAssigneeCommandAndSearchIssueRequest,
  BatchCommandOfIssueSetPriorityCommandAndSearchIssueRequest,
  BatchCommandOfIssueSetStateCommandAndSearchIssueRequest,
  GetIssueByKeyRequest,
  GetIssueRequest,
  IssueAddCommentCommand,
  IssueAddWatcherCommand,
  IssueCreateCommand,
  IssueDto,
  IssueRemoveCommentCommand,
  IssueRemoveWatcherCommand,
  IssueSetCommentBodyCommand,
  IssueAddLinkCommand,
  IssueRemoveLinkCommand,
  IssueSetCustomFieldsCommand,
  IssueSetParentCommand,
  IssueSetDescriptionCommand,
  IssueSetDueDateCommand,
  IssueSetStateCommand,
  IssueSetTitleCommand,
  IssueSetTypeCommand,
  SearchIssueRequest,
  SearchResponse,
  TaskManagementClient,
} from '../../api-client';
import { TaskManagementProjectOrchestrator } from '../project/project.orchestrator';
import { ProjectVM } from '../project/project.view-model';
import { IssueVM } from './issue.view-model';

/**
 * Orkiestrator zgłoszeń (`Issue` — nigdy `Task`, patrz
 * `docs/backend/task-management.md` §2).
 *
 * Projekt rozwiązuje się z sąsiedniego orkiestratora przez leniwe wstrzyknięcie `Injector`em —
 * ten sam wzorzec co `Product` → `Category` w Catalogu
 * (`docs/frontend/orchestrators.md` §2).
 */
@Injectable({ providedIn: 'root' })
export class TaskManagementIssueOrchestrator extends BaseOrchestrator<
  IssueDto,
  IssueVM,
  SearchIssueRequest,
  LoadOptions
> {
  private readonly _api = inject(TaskManagementClient);
  private readonly _users = inject(UserDirectoryService);
  private readonly _injector = inject(Injector);
  private _projects: TaskManagementProjectOrchestrator | null = null;

  private get _projectSibling(): TaskManagementProjectOrchestrator {
    if (!this._projects) {
      this._projects = this._injector.get(TaskManagementProjectOrchestrator);
    }
    return this._projects;
  }

  protected override readonly signature = 'taskmgmt.issue';

  protected override readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string } = {
    signalrSignature: 'taskmgmt.issue',
    maxCacheSize: 1000,
  };

  protected override fetchByUuids(uuids: string[]): Observable<IssueDto[]> {
    return this._api.getIssue({ uuids } as GetIssueRequest);
  }

  protected override searchByFilters(filters: SearchIssueRequest): Observable<SearchResponse> {
    return this._api.searchIssue(filters);
  }

  protected override mapToViewModel(dto: IssueDto, resolvedDeps: ResolvedDeps): IssueVM {
    return {
      ...dto,
      project: resolvedDeps['project'] as ProjectVM | undefined,
      assignee: resolvedDeps['assignee'] as ErpUserRef | undefined,
      reporter: resolvedDeps['reporter'] as ErpUserRef | undefined,
    };
  }

  protected override async resolveEagerDependencies(uuids: string[]): Promise<void> {
    const projectUuids = new Set<string>();
    const userUuids = new Set<string>();

    for (const uuid of uuids) {
      const dto = this.identityMap.peek(uuid);

      if (dto?.projectUuid) {
        projectUuids.add(dto.projectUuid);
      }

      // Przypisany i zgłaszający idą do katalogu jedną paczką na całą stronę listy —
      // serwis skleja zamówienia z tego samego cyklu w jedno żądanie.
      if (dto?.assigneeUuid) {
        userUuids.add(dto.assigneeUuid);
      }

      if (dto?.reporterUuid) {
        userUuids.add(dto.reporterUuid);
      }
    }

    await Promise.all([
      projectUuids.size > 0 ? this._projectSibling.loadAsync([...projectUuids]) : Promise.resolve(),
      userUuids.size > 0 ? this._users.loadAsync([...userUuids]) : Promise.resolve(),
    ]);
  }

  protected override _resolveCurrentDeps(dto: IssueDto): ResolvedDeps {
    return {
      project: dto.projectUuid ? this._projectSibling.getOne(dto.projectUuid)() : undefined,
      // Odczyt sygnału katalogu — wiersz przerysuje się sam, gdy nazwisko dojedzie.
      assignee: this._users.getOne(dto.assigneeUuid)(),
      reporter: this._users.getOne(dto.reporterUuid)(),
    };
  }

  /**
   * Zgłoszenie po kluczu czytelnym (`DEV-412`) — droga wejścia na kartę z linku w mailu.
   *
   * Odpowiedź trafia do wspólnego cache przez `loadAsync`, więc karta i lista widzą ten sam
   * obiekt i tak samo reagują na zdarzenie SignalR. Backend rozwiązuje też klucze historyczne
   * (`issue.previous_keys`), więc link sprzed przeniesienia projektu nadal działa.
   */
  public async loadByKeyAsync(key: string): Promise<IssueVM | undefined> {
    const dto = await this.runDirectCommandAsync(() => this._api.getIssueByKey({ key } as GetIssueByKeyRequest));

    if (!dto?.uuid) {
      return undefined;
    }

    // `{}` zamiast pominięcia opcji: `BaseOrchestrator.loadAsync` woła
    // `resolveEagerDependencies` WYŁĄCZNIE, gdy dostanie obiekt opcji — bez niego karta
    // wyświetliłaby sam kod projektu zamiast jego nazwy.
    await this.loadAsync([dto.uuid], {});
    return this.getOne(dto.uuid)();
  }

  // ── Komendy ──
  //
  // Każda mutacja idzie przez `BatchEndpointBase` — nawet zmiana tytułu jednego zgłoszenia jest
  // zadaniem z jednym elementem. Metody zwracają `jobUuid`, nie wynik operacji.

  /**
   * Zakłada zgłoszenie. `uuid` generuje klient (`crypto.randomUUID()`) i NADPISUJE cokolwiek
   * przyszło z formularza — tryb `Commands[]` wymaga identyfikatora w payloadzie.
   *
   * **Klucza czytelnego tu nie ma i być nie może**: nadaje go serwer z licznika projektu,
   * w tej samej transakcji co zapis (`docs/backend/task-management.md` §4).
   */
  public async createIssueAsync(command: IssueCreateCommand, queueId?: string): Promise<string> {
    const uuid = crypto.randomUUID();

    const jobUuid = await this.runSingleCommandAsync(
      (p) => this._api.issueCreateMultipleCommand(p),
      { ...command, uuid } as IssueCreateCommand,
      { commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.createIssue, queueId },
    );

    // Uuid jest znany od razu, zadanie kończy się asynchronicznie — ładujemy optymistycznie.
    // Jeśli zadanie odpadnie (np. na uprawnieniu), wpisu po prostu nie będzie w odpowiedzi.
    await this.loadAsync([uuid], {});
    return jobUuid;
  }

  public setTitleAsync(command: IssueSetTitleCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.issueSetTitleMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setIssueTitle,
      queueId,
    });
  }

  public setDescriptionAsync(command: IssueSetDescriptionCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.issueSetDescriptionMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setIssueDescription,
      queueId,
    });
  }

  /** Zapis opisu z natychmiastowym, optymistycznym skutkiem — patrz `setStateOptimisticAsync`. */
  public setDescriptionOptimisticAsync(
    uuid: string,
    description: string | undefined,
    options?: { onRollback?: () => void; failureMessage?: Translatable },
  ): Promise<void> {
    return this.runOptimisticCommandAsync(
      uuid,
      (current) => (current ? { ...current, description } : current),
      () => this.setDescriptionAsync({ uuid, description }),
      options,
    );
  }

  public setDueDateAsync(command: IssueSetDueDateCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.issueSetDueDateMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setIssueDueDate,
      queueId,
    });
  }

  /**
   * Zmiana stanu jednego zgłoszenia — z karty, przyciskiem dostępnego przejścia.
   * Przejście spoza schematu odpada po stronie backendu jako `taskmgmt.transition_not_allowed`,
   * więc front nie musi (i nie powinien) duplikować tej reguły; wygaszenie niedostępnych
   * przycisków to wygoda, nie kontrola.
   */
  /**
   * Nadpisuje <b>całą</b> mapę wartości pól niestandardowych. Pole pominięte w mapie zostaje
   * wyczyszczone — komenda ma człon w liczbie mnogiej, więc to, co przyszło, jest tym, co
   * zostaje (`docs/backend/endpoint-naming.md` §2).
   *
   * <p>Wartości jadą jako tekst w postaci kanonicznej (liczba z kropką, data ISO-8601 UTC,
   * użytkownik jako uuid), bo kontrakt NSwag musi mieć jeden typ na pole, a nie union zależny
   * od danych z bazy (`docs/backend/task-management.md` §6).</p>
   */
  public setCustomFieldsAsync(command: IssueSetCustomFieldsCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.issueSetCustomFieldsMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setIssueCustomFields,
      queueId,
    });
  }

  // ── Hierarchia i powiązania ──
  //
  // Komendy nazywają się `IssueSetParent…`/`IssueAddLink…`, bo agregatem jest ZGŁOSZENIE —
  // krawędź powiązania ma własny korzeń w bazie, ale operacja wychodzi zawsze z karty
  // zgłoszenia (`docs/backend/task-management.md` §8.1).

  /**
   * Ustawia albo zdejmuje rodzica. Pusty `parentUuid` wypina zgłoszenie z hierarchii — to
   * poprawna operacja, nie brak decyzji.
   *
   * <p>Pętli front NIE sprawdza: robi to reguła wsadowa `IssueParentCycleRule` rekurencyjnym
   * CTE, a handler powtarza sprawdzenie jako drugą linię obrony. Dublowanie tego w przeglądarce
   * dałoby trzecią kopię reguły, która rozjedzie się pierwsza.</p>
   */
  public setParentAsync(command: IssueSetParentCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.issueSetParentMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setIssueParent,
      queueId,
    });
  }

  /** Dopina powiązanie; `uuid` to ŹRÓDŁO krawędzi, bo kierunek jest częścią znaczenia. */
  public addLinkAsync(command: IssueAddLinkCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync(
      (p) => this._api.issueAddLinkMultipleCommand(p),
      { ...command, linkUuid: command.linkUuid || crypto.randomUUID() } as IssueAddLinkCommand,
      { commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.addIssueLink, queueId },
    );
  }

  /** Odpina powiązanie — wolno to zrobić z obu jego stron. */
  public removeLinkAsync(command: IssueRemoveLinkCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.issueRemoveLinkMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.removeIssueLink,
      queueId,
    });
  }

  public setStateAsync(command: IssueSetStateCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.issueSetStateMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setIssueState,
      queueId,
    });
  }

  /**
   * Zmiana stanu z natychmiastowym, optymistycznym skutkiem — karta zgłoszenia przerysowuje
   * się od razu, zamiast czekać na `BulkCommandRunner`. Patrz `runOptimisticCommandAsync` na
   * bazie i `docs/frontend/optimistic-updates.md`. Bramki (`WF-004`, ostrzeżenia grafu) leżą
   * PRZED wywołaniem tej metody, w komponencie — tak samo jak dziś.
   */
  public setStateOptimisticAsync(
    uuid: string,
    stateUuid: string,
    options?: { onRollback?: () => void; failureMessage?: Translatable },
  ): Promise<void> {
    return this.runOptimisticCommandAsync(
      uuid,
      (current) => (current ? { ...current, stateUuid } : current),
      () => this.setStateAsync({ uuid, stateUuid }),
      options,
    );
  }

  /**
   * Zmienia typ zgłoszenia (`TYP-003`). Backend waliduje, że typ należy do schematu projektu
   * i mapuje stan przy zmianie schematu stanów (AC2); front nie duplikuje tej regułę — pokazuje
   * jej wynik, w tym ewentualny błąd o brakujących polach wymaganych przez nowy typ (`WF-004`).
   */
  public setTypeAsync(command: IssueSetTypeCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.issueSetTypeMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setIssueType,
      queueId,
    });
  }

  /** Zmiana typu z natychmiastowym, optymistycznym skutkiem — patrz `setStateOptimisticAsync`. */
  public setTypeOptimisticAsync(
    uuid: string,
    typeUuid: string,
    options?: { onRollback?: () => void; failureMessage?: Translatable },
  ): Promise<void> {
    return this.runOptimisticCommandAsync(
      uuid,
      (current) => (current ? { ...current, typeUuid } : current),
      () => this.setTypeAsync({ uuid, typeUuid }),
      options,
    );
  }

  // ── Komentarze ──
  //
  // Komendy nazywają się `IssueAddComment…`, bo agregatem jest ZGŁOSZENIE, nie komentarz —
  // i dlatego mieszkają tutaj, a nie w `IssueCommentService` (ten trzyma sam odczyt).
  // Lista odświeża się zdarzeniem na `taskmgmt.issue_comment`, więc żadna z tych metod nie
  // dopisuje niczego do cache’u ręcznie: cudzy komentarz i własny wracają tą samą drogą.

  /**
   * Dodaje komentarz. `uuid` generuje klient — tryb `Commands[]` wymaga identyfikatora
   * w payloadzie, a wątek i tak wraca z serwera.
   *
   * <p>`command.uuid` przechodzi bez zmian, gdy wywołujący go już podał — tak samo jak
   * `addLinkAsync` niżej. Nakładka optymistyczna komentarzy (`IssueActivityComponent`) generuje
   * uuid PRZED wywołaniem, żeby element wstawiony do `IssueCommentService` patchem miał
   * dokładnie ten sam identyfikator, którym serwer w końcu odpowie.</p>
   */
  public addCommentAsync(command: IssueAddCommentCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync(
      (p) => this._api.issueAddCommentMultipleCommand(p),
      { ...command, uuid: command.uuid || crypto.randomUUID() } as IssueAddCommentCommand,
      { commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.addIssueComment, queueId },
    );
  }

  /** Zmienia treść własnego komentarza; cudzy odrzuci backend (`taskmgmt.comment_not_author`). */
  public setCommentBodyAsync(command: IssueSetCommentBodyCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.issueSetCommentBodyMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setIssueCommentBody,
      queueId,
    });
  }

  /** Usuwa komentarz — miękko: wiersz zostaje, treść znika (odpowiedzi mają się do czego piąć). */
  public removeCommentAsync(command: IssueRemoveCommentCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.issueRemoveCommentMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.removeIssueComment,
      queueId,
    });
  }

  // ── Komendy wsadowe na zaznaczeniu z listy ──
  //
  // Cele buduje wywołujący przez `erpBuildBatchTargets(store.scope())`
  // (`docs/frontend/selection-scope.md` §3) — nigdy ręcznym składaniem `targetUuids`.

  public setStateMultipleAsync(
    payload: BatchCommandOfIssueSetStateCommandAndSearchIssueRequest,
    queueId?: string,
  ): Promise<string> {
    return this.runBatchCommandAsync((p) => this._api.issueSetStateMultipleCommand(p), payload, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setIssueState,
      queueId,
    });
  }

  public setAssigneeMultipleAsync(
    payload: BatchCommandOfIssueSetAssigneeCommandAndSearchIssueRequest,
    queueId?: string,
  ): Promise<string> {
    return this.runBatchCommandAsync((p) => this._api.issueSetAssigneeMultipleCommand(p), payload, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setIssueAssignee,
      queueId,
    });
  }

  public setPriorityMultipleAsync(
    payload: BatchCommandOfIssueSetPriorityCommandAndSearchIssueRequest,
    queueId?: string,
  ): Promise<string> {
    return this.runBatchCommandAsync((p) => this._api.issueSetPriorityMultipleCommand(p), payload, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setIssuePriority,
      queueId,
    });
  }

  // ── Obserwujący (ISS-009) ──
  //
  // Batch endpointy przyjmują jeden element (`commands: [command]`) — na karcie zgłoszenia nie
  // ma zaznaczenia z listy, więc `targetUuids` zawsze jest puste.

  public addWatcherAsync(command: IssueAddWatcherCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.issueAddWatcherMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.addIssueWatcher,
      queueId,
    });
  }

  public removeWatcherAsync(command: IssueRemoveWatcherCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.issueRemoveWatcherMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.removeIssueWatcher,
      queueId,
    });
  }

  /**
   * Przełącznik „obserwuję" z natychmiastowym, optymistycznym skutkiem — patrz
   * `setStateOptimisticAsync`. Zawsze bieżący użytkownik: backend rozwiązuje go z tokenu
   * (`Issue.Watch()`/`Unwatch()`), komenda nie niesie cudzego uuid.
   */
  public toggleWatchOptimisticAsync(
    uuid: string,
    watched: boolean,
    options?: { onRollback?: () => void; failureMessage?: Translatable },
  ): Promise<void> {
    return this.runOptimisticCommandAsync(
      uuid,
      (current) =>
        current
          ? {
              ...current,
              isWatchedByMe: watched,
              watcherCount: Math.max(0, current.watcherCount + (watched ? 1 : -1)),
            }
          : current,
      () => (watched ? this.addWatcherAsync({ uuid }) : this.removeWatcherAsync({ uuid })),
      options,
    );
  }
}
