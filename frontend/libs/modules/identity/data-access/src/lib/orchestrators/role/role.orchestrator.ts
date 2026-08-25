import { Injectable, Injector, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { BaseOrchestrator, LoadOptions, OrchestratorConfig, ResolvedDeps } from '@erp/shared/data-access';
import { IDENTITY_JOB_COMMAND_KEYS } from '@erp/identity/util';
import {
  IdentityClient,
  BatchCommandOfRoleAddMemberCommandAndSearchRoleRequest,
  BatchCommandOfRoleAddPermissionCommandAndSearchRoleRequest,
  GetRoleRequest,
  SearchRoleRequest,
  SearchResponse,
  RoleDto,
  RoleCreateCommand,
  RoleRemoveMemberCommand,
  RoleRemovePermissionCommand,
} from '../../api-client';
import { RoleVM } from './role.view-model';

/**
 * Orkiestrator ról (`Role` — agregat DAG, patrz `docs/backend/identity-authz.md` §2).
 * `memberRoleUuids` rozwiązuje się do `members: RoleVM[]` przez SAMEGO SIEBIE (rola składa się
 * z ról) — leniwe wstrzyknięcie przez `Injector`, ten sam wzorzec co przy sąsiednich
 * orkiestratorach w `docs/frontend/orchestrators.md` §2, tylko że sąsiadem jest własna klasa.
 */
@Injectable({ providedIn: 'root' })
export class RoleOrchestrator extends BaseOrchestrator<RoleDto, RoleVM, SearchRoleRequest, LoadOptions> {
  private readonly _api = inject(IdentityClient);
  private readonly _injector = inject(Injector);
  private _self: RoleOrchestrator | null = null;

  private get _selfSibling(): RoleOrchestrator {
    if (!this._self) {
      this._self = this._injector.get(RoleOrchestrator);
    }
    return this._self;
  }

  protected override readonly signature = 'identity.role';

  protected override readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string } = {
    signalrSignature: 'identity.role',
    maxCacheSize: 500,
  };

  protected override fetchByUuids(uuids: string[]): Observable<RoleDto[]> {
    return this._api.getRole({ uuids } as GetRoleRequest);
  }

  protected override searchByFilters(filters: SearchRoleRequest): Observable<SearchResponse> {
    return this._api.searchRole(filters);
  }

  protected override mapToViewModel(dto: RoleDto, resolvedDeps: ResolvedDeps): RoleVM {
    return { ...dto, members: (resolvedDeps['members'] as RoleVM[]) ?? [] };
  }

  protected override _resolveCurrentDeps(dto: RoleDto): ResolvedDeps {
    const members = (dto.memberRoleUuids ?? [])
      .map((uuid) => this._selfSibling.getOne(uuid)())
      .filter((vm): vm is RoleVM => vm !== undefined);
    return { members };
  }

  /**
   * Role-kontenery zawierające `roleUuid` jako składową — odwrotny kierunek DAG, wyliczony
   * przeszukaniem WSZYSTKICH aktualnie załadowanych ról (`identityMap.getAll()`). Poprawny
   * wynik wymaga, żeby strona miała już załadowany pełny zbiór ról — patrz strona `/identity/roles`,
   * która ładuje wszystkie role na starcie zamiast paginacji serwerowej.
   */
  public getContainerRoles(roleUuid: string): RoleVM[] {
    const all = this.identityMap.getAll()();
    const containers: RoleVM[] = [];
    for (const dto of all.values()) {
      if ((dto.memberRoleUuids ?? []).includes(roleUuid)) {
        containers.push(this.mapToViewModel(dto, this._resolveCurrentDeps(dto)));
      }
    }
    return containers;
  }

  // ── Komendy — patrz uzasadnienie podziału single-target/wsadowe w `UserOrchestrator` ──
  //
  // Wszystkie idą przez odpowiednik `BatchEndpointBase` — nawet wywołanie na jednej roli jest
  // zadaniem z jednym elementem (patrz Faza 1+3 w docs/backend/identity-bulk-migration.md);
  // obrys wykonania daje `runBatchCommandAsync`/`runSingleCommandAsync` z `BaseOrchestrator`.
  // Metody zwracają `jobUuid`, nie wynik operacji. `addPermissionMultipleAsync`/
  // `addMemberMultipleAsync` niżej obsługują OBA wywołania (panel szczegółów z `targetUuids:
  // [uuid]`, lista z `erpBuildBatchTargets(scope)`); `removePermissionAsync`/`removeMemberAsync`
  // zostają w trybie `Commands: [command]` — usuwanie znanego grantu nie jest naturalną operacją
  // nad zaznaczeniem wielu wierszy.

  /** Zakłada rolę. `command.uuid` jest generowany PO STRONIE KLIENTA (`crypto.randomUUID()`)
   * i NADPISUJE cokolwiek przyszło z formularza — backend nie generuje już identyfikatora,
   * bo tworzenie roli idzie przez tryb `Commands[]`, dla którego uuid celu jest częścią
   * payloadu, nie wynikiem odpowiedzi (patrz `RoleCreateCommand.Uuid` w
   * `Identity.Application.Roles.RoleCommands`). */
  public async createRoleAsync(command: RoleCreateCommand, queueId?: string): Promise<string> {
    const uuid = crypto.randomUUID();
    const jobUuid = await this.runSingleCommandAsync(
      p => this._api.roleCreateMultipleCommand(p),
      { ...command, uuid } as RoleCreateCommand,
      { commandName: IDENTITY_JOB_COMMAND_KEYS.createRole, queueId },
    );
    // `loadAsync` (nie `dataLoader.reloadAsync`) — to nowy uuid, jeszcze nieobecny w
    // `_loadedUuids`. Zadanie kończy się asynchronicznie (patrz Faza 1), ale UUID jest znany
    // od razu — ładujemy optymistycznie; jeśli zadanie odpadnie (np. `role_code_duplicate`),
    // wpis po prostu nie zostanie znaleziony i zniknie z cache przy kolejnym odświeżeniu.
    await this.loadAsync([uuid]);
    return jobUuid;
  }

  public removeMemberAsync(command: RoleRemoveMemberCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync(p => this._api.roleRemoveMemberMultipleCommand(p), command, {
      commandName: IDENTITY_JOB_COMMAND_KEYS.removeRoleMember,
      queueId,
    });
  }

  public removePermissionAsync(command: RoleRemovePermissionCommand, queueId?: string): Promise<string> {
    return this.runSingleCommandAsync(p => this._api.roleRemovePermissionMultipleCommand(p), command, {
      commandName: IDENTITY_JOB_COMMAND_KEYS.removeRolePermission,
      queueId,
    });
  }

  // ── Komendy wsadowe na zaznaczeniu z listy ──
  //
  // Cele buduje wywołujący przez `erpBuildBatchTargets(store.scope())` (patrz
  // `docs/frontend/selection-scope.md` §3). Tylko dodawanie — odbieranie uprawnienia/składowej
  // zostaje jako akcja jednego wiersza w panelu szczegółów (usuwanie konkretnego, znanego
  // grantu nie jest naturalną operacją „to samo dla wielu zaznaczonych").

  public addPermissionMultipleAsync(
    payload: BatchCommandOfRoleAddPermissionCommandAndSearchRoleRequest,
    queueId?: string,
  ): Promise<string> {
    return this.runBatchCommandAsync(p => this._api.roleAddPermissionMultipleCommand(p), payload, {
      commandName: IDENTITY_JOB_COMMAND_KEYS.addRolePermission,
      queueId,
    });
  }

  public addMemberMultipleAsync(
    payload: BatchCommandOfRoleAddMemberCommandAndSearchRoleRequest,
    queueId?: string,
  ): Promise<string> {
    return this.runBatchCommandAsync(p => this._api.roleAddMemberMultipleCommand(p), payload, {
      commandName: IDENTITY_JOB_COMMAND_KEYS.addRoleMember,
      queueId,
    });
  }
}
