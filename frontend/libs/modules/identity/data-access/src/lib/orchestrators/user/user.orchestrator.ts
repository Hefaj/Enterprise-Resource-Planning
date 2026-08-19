import { Injectable, Injector, Signal, WritableSignal, inject, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';

import { BaseOrchestrator, LoadOptions, OrchestratorConfig, ResolvedDeps } from '@erp/shared/data-access';
import {
  IdentityClient,
  GetUserAccountRequest,
  SearchUserAccountRequest,
  SearchResponse,
  UserAccountDto,
  UserAssignRoleCommand,
  UserRevokeRoleCommand,
  UserGrantPermissionCommand,
  UserRevokePermissionCommand,
} from '../../api-client';
import { RoleOrchestrator } from '../role/role.orchestrator';
import { UserVM } from './user.view-model';

/**
 * Orkiestrator kont użytkowników (`UserAccount`, patrz `docs/backend/identity-authz.md` §2).
 * `roleGrants[].role` rozwiązywany leniwie z `RoleOrchestrator` (wzorzec §2 orchestrators.md —
 * cykliczna zależność między orkiestratorami rozwiązana przez `Injector`, nie konstruktor).
 */
@Injectable({ providedIn: 'root' })
export class UserOrchestrator extends BaseOrchestrator<UserAccountDto, UserVM, SearchUserAccountRequest, LoadOptions> {
  private readonly _api = inject(IdentityClient);
  private readonly _injector = inject(Injector);
  private _roleOrchestrator: RoleOrchestrator | null = null;

  private get _roleSiblingOrchestrator(): RoleOrchestrator {
    if (!this._roleOrchestrator) {
      this._roleOrchestrator = this._injector.get(RoleOrchestrator);
    }
    return this._roleOrchestrator;
  }

  protected override readonly signature = 'identity.user';

  protected override readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string } = {
    // Ta sama sygnatura co `PermissionStore` (Faza 5/6) — cache konta i tak odświeży się na
    // żywo przy zmianie własnych uprawnień; dla kont innych userów to głównie no-op, bez szkody.
    signalrSignature: 'identity.user',
    maxCacheSize: 1000,
  };

  protected override fetchByUuids(uuids: string[]): Observable<UserAccountDto[]> {
    return this._api.getUser({ uuids } as GetUserAccountRequest);
  }

  protected override searchByFilters(filters: SearchUserAccountRequest): Observable<SearchResponse> {
    return this._api.searchUser(filters);
  }

  protected override mapToViewModel(dto: UserAccountDto, resolvedDeps: ResolvedDeps): UserVM {
    return {
      ...dto,
      roleGrants: (resolvedDeps['roleGrants'] as UserVM['roleGrants']) ?? [],
      permissionGrants: dto.permissionGrants ?? [],
    };
  }

  protected override _resolveCurrentDeps(dto: UserAccountDto): ResolvedDeps {
    const roleGrants = (dto.roleGrants ?? []).map((grant) => ({
      ...grant,
      role: this._roleSiblingOrchestrator.getOne(grant.roleUuid)() ?? null,
    }));
    return { roleGrants };
  }

  /** Dociąga role przypisane załadowanym użytkownikom, żeby `_resolveCurrentDeps` miało co
   * czytać z cache `RoleOrchestrator` — bez tego tabela ról w panelu szczegółów pokazywałaby
   * gołe UUID zamiast kodu/nazwy roli, dopóki ktoś inny (np. strona `/identity/roles`) nie
   * załaduje tych samych ról niezależnie. Wywoływane tylko, gdy `loadAsync`/`searchAsync`
   * dostają jakikolwiek (nawet pusty) obiekt `loadOptions` — patrz wywołania w `feature`. */
  protected override async resolveEagerDependencies(uuids: string[]): Promise<void> {
    const roleUuids = new Set<string>();
    for (const uuid of uuids) {
      const dto = this.identityMap.peek(uuid);
      for (const grant of dto?.roleGrants ?? []) {
        roleUuids.add(grant.roleUuid);
      }
    }
    if (roleUuids.size > 0) {
      await this._roleSiblingOrchestrator.loadAsync([...roleUuids]);
    }
  }

  // ── Komendy ──

  public async assignRoleAsync(command: UserAssignRoleCommand): Promise<void> {
    await this._runCommand(() => this._api.assignUserRole(command), command.userUuid);
  }

  public async revokeRoleAsync(command: UserRevokeRoleCommand): Promise<void> {
    await this._runCommand(() => this._api.revokeUserRole(command), command.userUuid);
  }

  public async grantPermissionAsync(command: UserGrantPermissionCommand): Promise<void> {
    await this._runCommand(() => this._api.grantUserPermission(command), command.userUuid);
  }

  public async revokePermissionAsync(command: UserRevokePermissionCommand): Promise<void> {
    await this._runCommand(() => this._api.revokeUserPermission(command), command.userUuid);
  }

  public async forceLogoutAsync(userUuid: string): Promise<void> {
    await this._runCommand(() => this._api.forceLogoutUser({ uuid: userUuid }), undefined);
  }

  private async _runCommand(call: () => Observable<string>, affectedUuid?: string): Promise<void> {
    try {
      await firstValueFrom(call());
      if (affectedUuid) {
        await this.dataLoader.reloadAsync([affectedUuid]);
      }
    } catch (err) {
      this.addError({ operation: 'command', message: err instanceof Error ? err.message : String(err), timestamp: new Date() });
      throw err;
    }
  }

  // ── Efektywne uprawnienia — side-channel poza identity-mapą, patrz plan §2.1 ──

  private readonly _effectivePermissions = new Map<string, WritableSignal<string[]>>();

  private _effectiveSignalFor(uuid: string): WritableSignal<string[]> {
    let sig = this._effectivePermissions.get(uuid);
    if (!sig) {
      sig = signal<string[]>([]);
      this._effectivePermissions.set(uuid, sig);
    }
    return sig;
  }

  /** Płaski, tylko-do-odczytu zbiór efektywnych kodów uprawnień. Bez rozwinięcia „skąd” —
   * backend eksponuje to tylko dla `/me` (patrz `docs/backend/identity-authz.md` §9). */
  public getEffectivePermissions(uuid: string): Signal<string[]> {
    return this._effectiveSignalFor(uuid).asReadonly();
  }

  public async loadEffectivePermissionsAsync(uuid: string): Promise<void> {
    try {
      const codes = await firstValueFrom(this._api.getUserPermissions(uuid));
      this._effectiveSignalFor(uuid).set(codes ?? []);
    } catch (err) {
      this.addError({ operation: 'load', message: err instanceof Error ? err.message : String(err), timestamp: new Date() });
      throw err;
    }
  }
}
