import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { BaseOrchestrator, LoadOptions, OrchestratorConfig } from '@erp/shared/data-access';
import { TASK_MANAGEMENT_JOB_COMMAND_KEYS } from '@erp/task-management/util';

import {
  SavedViewCreateCopyCommand,
  SavedViewCreateCommand,
  SavedViewDto,
  SavedViewRemoveCommand,
  SavedViewSetCommand,
  SearchResponse,
  SearchSavedViewRequest,
  TaskManagementClient,
} from '../../api-client';

/**
 * Orkiestrator zapisanych widoków listy zgłoszeń (`SavedView` — `VIEW-001`/`VIEW-002`).
 *
 * <p><b>Bez sygnatury realtime.</b> `AggregateSignatures` po stronie backendu dziś nie ma wpisu
 * dla `SavedView` (sprawdzone przy pisaniu tego orkiestratora — jest `TaskManagementWorkflowScheme`,
 * nie ma odpowiednika dla widoków), więc kanał `taskmgmt.saved_view` niżej jest tylko rezerwacją
 * nazwy: subskrypcja SignalR nic dziś nie odbiera. Widoki są prywatne per użytkownik albo dzielone
 * w obrębie jednego projektu — brak echa w czasie rzeczywistym nie boli tak, jak przy zgłoszeniach,
 * bo lista widoków odświeża się przy każdym wejściu na filtr. Dopisanie sygnatury po stronie
 * backendu (`Erp.BuildingBlocks.Contracts/AggregateSignatures.cs`) to osobne zadanie poza zakresem
 * frontendu.</p>
 */
@Injectable({ providedIn: 'root' })
export class TaskManagementSavedViewOrchestrator extends BaseOrchestrator<
  SavedViewDto,
  SavedViewDto,
  SearchSavedViewRequest,
  LoadOptions
> {
  private readonly _api = inject(TaskManagementClient);

  protected override readonly signature = 'taskmgmt.saved_view';

  protected override readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string } = {
    signalrSignature: 'taskmgmt.saved_view',
    maxCacheSize: 500,
  };

  protected override fetchByUuids(uuids: string[]): Observable<SavedViewDto[]> {
    const wanted = new Set(uuids);

    return this._api
      .searchSavedView({} as SearchSavedViewRequest)
      .pipe(map((views) => views.filter((view) => wanted.has(view.uuid))));
  }

  protected override searchByFilters(filters: SearchSavedViewRequest): Observable<SearchResponse> {
    return this._api
      .searchSavedView(filters)
      .pipe(map((views) => ({ uuids: views.map((view) => view.uuid), totalCount: views.length }) as SearchResponse));
  }

  protected override mapToViewModel(dto: SavedViewDto): SavedViewDto {
    return dto;
  }

  /** Widoki własne + udostępnione projektowi (`SearchSavedView` zwraca oba naraz). */
  public async searchViewsAsync(request: SearchSavedViewRequest): Promise<SavedViewDto[]> {
    const views = await this.runDirectCommandAsync(() => this._api.searchSavedView(request));
    this.identityMap.setMany(views);
    await this.loadAsync(views.map((view) => view.uuid));
    return views;
  }

  /** Zapisuje obecny filtr/sort/kolumny/tryb jako nowy widok. `uuid` generuje klient. */
  public async createAsync(command: SavedViewCreateCommand, queueId?: string): Promise<string> {
    const uuid = crypto.randomUUID();

    const jobUuid = await this.runSingleCommandAsync(
      (p) => this._api.savedViewCreateMultipleCommand(p),
      { ...command, uuid } as SavedViewCreateCommand,
      { commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.createSavedView, queueId },
    );

    await this.loadAsync([uuid]);
    return jobUuid;
  }

  public async setAsync(command: SavedViewSetCommand, queueId?: string): Promise<string> {
    const jobUuid = await this.runSingleCommandAsync((p) => this._api.savedViewSetMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.setSavedView,
      queueId,
    });

    if (command.uuid) {
      await this.loadAsync([command.uuid]);
    }

    return jobUuid;
  }

  public removeAsync(command: SavedViewRemoveCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.savedViewRemoveMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.removeSavedView,
      queueId,
    });
  }

  /** Kopiuje cudzy udostępniony widok do siebie jako prywatny (VIEW-001 AC1 — jedno kliknięcie).
   * `uuid` (nowy) generuje klient, `sourceUuid` wskazuje widok do skopiowania po stronie handlera. */
  public async copyAsync(command: SavedViewCreateCopyCommand, queueId?: string): Promise<string> {
    const uuid = crypto.randomUUID();

    const jobUuid = await this.runSingleCommandAsync(
      (p) => this._api.savedViewCreateCopyMultipleCommand(p),
      { ...command, uuid } as SavedViewCreateCopyCommand,
      { commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.copySavedView, queueId },
    );

    await this.loadAsync([uuid]);
    return jobUuid;
  }
}
