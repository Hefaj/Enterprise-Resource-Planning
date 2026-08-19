import { Injectable, Injector, inject } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';

import { BaseOrchestrator, LoadOptions, OrchestratorConfig, ResolvedDeps } from '@erp/shared/data-access';
import {
  IdentityClient,
  GetRoleRequest,
  SearchRoleRequest,
  SearchResponse,
  RoleDto,
  RoleCreateCommand,
  RoleAddMemberCommand,
  RoleRemoveMemberCommand,
  RoleAddPermissionCommand,
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

  public async createRoleAsync(command: RoleCreateCommand): Promise<string> {
    try {
      const uuid = await firstValueFrom(this._api.createRole(command));
      // `loadAsync` (nie `dataLoader.reloadAsync`) — to nowy uuid, jeszcze nieobecny w
      // `_loadedUuids`; samo odświeżenie cache'u bez tego nie pokazałoby się w `getViewModel()`.
      await this.loadAsync([uuid]);
      return uuid;
    } catch (err) {
      this.addError({ operation: 'command', message: err instanceof Error ? err.message : String(err), timestamp: new Date() });
      throw err;
    }
  }

  public async addMemberAsync(command: RoleAddMemberCommand): Promise<void> {
    await this._runCommand(() => this._api.addRoleMember(command), command.containerRoleUuid);
  }

  public async removeMemberAsync(command: RoleRemoveMemberCommand): Promise<void> {
    await this._runCommand(() => this._api.removeRoleMember(command), command.containerRoleUuid);
  }

  public async addPermissionAsync(command: RoleAddPermissionCommand): Promise<void> {
    await this._runCommand(() => this._api.addRolePermission(command), command.roleUuid);
  }

  public async removePermissionAsync(command: RoleRemovePermissionCommand): Promise<void> {
    await this._runCommand(() => this._api.removeRolePermission(command), command.roleUuid);
  }

  private async _runCommand(call: () => Observable<string>, affectedRoleUuid?: string): Promise<void> {
    try {
      await firstValueFrom(call());
      if (affectedRoleUuid) {
        await this.dataLoader.reloadAsync([affectedRoleUuid]);
      }
    } catch (err) {
      this.addError({ operation: 'command', message: err instanceof Error ? err.message : String(err), timestamp: new Date() });
      throw err;
    }
  }
}
