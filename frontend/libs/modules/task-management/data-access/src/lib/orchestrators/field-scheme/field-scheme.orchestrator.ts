import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { BaseOrchestrator, LoadOptions, OrchestratorConfig } from '@erp/shared/data-access';
import { TASK_MANAGEMENT_JOB_COMMAND_KEYS } from '@erp/task-management/util';

import {
  FieldSchemeAddFieldCommand,
  FieldSchemeCreateCommand,
  FieldSchemeDto,
  FieldSchemeRemoveFieldCommand,
  SearchFieldSchemeRequest,
  SearchResponse,
  TaskManagementClient,
} from '../../api-client';

/**
 * Orkiestrator schematów pól niestandardowych.
 *
 * <p><b>Odczyt idzie jednym zapytaniem po całości</b> (`searchFieldScheme` zwraca schematy razem
 * z definicjami), a nie parą „szukaj uuid-y → dociągnij po uuid": schematów są dziesiątki, nie
 * tysiące, i zawsze ogląda się je w całości na ekranie konfiguracji. Stronicowania backend tu
 * nie wystawia, więc `searchByFilters` mapuje odpowiedź na identyfikatory, a `fetchByUuids`
 * odpytuje ponownie i filtruje — cena to jedno dodatkowe żądanie na wejście, zysk to cache
 * tożsamości i odświeżanie kanałem `taskmgmt.field_scheme` za darmo.</p>
 */
@Injectable({ providedIn: 'root' })
export class TaskManagementFieldSchemeOrchestrator extends BaseOrchestrator<
  FieldSchemeDto,
  FieldSchemeDto,
  SearchFieldSchemeRequest,
  LoadOptions
> {
  private readonly _api = inject(TaskManagementClient);

  protected override readonly signature = 'taskmgmt.field_scheme';

  protected override readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string } = {
    signalrSignature: 'taskmgmt.field_scheme',
    maxCacheSize: 200,
  };

  protected override fetchByUuids(uuids: string[]): Observable<FieldSchemeDto[]> {
    return this._api
      .searchFieldScheme({} as SearchFieldSchemeRequest)
      .pipe(map((schemes) => schemes.filter((scheme) => uuids.includes(scheme.uuid))));
  }

  protected override searchByFilters(filters: SearchFieldSchemeRequest): Observable<SearchResponse> {
    return this._api
      .searchFieldScheme(filters)
      .pipe(
        map(
          (schemes) => ({ uuids: schemes.map((s) => s.uuid), totalCount: schemes.length }) as SearchResponse,
        ),
      );
  }

  protected override mapToViewModel(dto: FieldSchemeDto): FieldSchemeDto {
    return dto;
  }

  /** Zakłada schemat pól. `uuid` generuje klient — tryb `Commands[]` wymaga go w payloadzie. */
  public async createAsync(command: FieldSchemeCreateCommand, queueId?: string): Promise<string> {
    const uuid = crypto.randomUUID();

    const jobUuid = await this.runSingleCommandAsync(
      (p) => this._api.fieldSchemeCreateMultipleCommand(p),
      { ...command, uuid } as FieldSchemeCreateCommand,
      { commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.createFieldScheme, queueId },
    );

    await this.loadAsync([uuid]);
    return jobUuid;
  }

  /**
   * Dokłada definicję pola.
   *
   * <p><b>Slotu nie da się później zmienić</b> — nie ma takiej komendy i to jest cała egzekucja
   * reguły „mapowanie pole↔slot jest niezmienne po pierwszym użyciu"
   * (`docs/backend/task-management.md` §6). UI musi to powiedzieć użytkownikowi PRZED zapisem,
   * bo po nim jedyną drogą jest usunięcie pola, a to blokuje pierwsza zapisana wartość.</p>
   */
  public addFieldAsync(command: FieldSchemeAddFieldCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync(
      (p) => this._api.fieldSchemeAddFieldMultipleCommand(p),
      { ...command, fieldUuid: command.fieldUuid || crypto.randomUUID() } as FieldSchemeAddFieldCommand,
      { commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.addSchemeField, queueId },
    );
  }

  /** Usuwa definicję pola. Backend odmawia (`taskmgmt.field_in_use`), gdy którekolwiek
   * zgłoszenie ma w tym polu wartość — slot nie może wrócić do puli z danymi w środku. */
  public removeFieldAsync(command: FieldSchemeRemoveFieldCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync((p) => this._api.fieldSchemeRemoveFieldMultipleCommand(p), command, {
      commandName: TASK_MANAGEMENT_JOB_COMMAND_KEYS.removeSchemeField,
      queueId,
    });
  }
}
