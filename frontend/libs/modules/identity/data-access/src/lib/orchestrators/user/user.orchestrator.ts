import { Injectable, Injector, Signal, WritableSignal, inject, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';

import { BaseOrchestrator, JobMeta, LoadOptions, OrchestratorConfig, ResolvedDeps, withRequestId } from '@erp/shared/data-access';
import { IDENTITY_JOB_COMMAND_KEYS } from '@erp/identity/util';
import {
  IdentityClient,
  BatchResult,
  BatchCommandOfUserAddRoleCommandAndSearchUserAccountRequest,
  BatchCommandOfUserAddPermissionCommandAndSearchUserAccountRequest,
  BatchCommandOfUserExecForceLogoutCommandAndSearchUserAccountRequest,
  GetUserAccountRequest,
  SearchUserAccountRequest,
  SearchResponse,
  UserAccountDto,
  UserRemoveRoleCommand,
  UserRemovePermissionCommand,
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

  // ── Komendy — cele wsadu (§3 docs/frontend/selection-scope.md) ──
  //
  // Wszystkie idą przez odpowiednik `BatchEndpointBase` (patrz Faza 1+2 w
  // docs/backend/identity-bulk-migration.md). `addRoleMultipleAsync`/`addPermissionMultipleAsync`/
  // `execForceLogoutMultipleAsync` obsługują OBA przypadki wywołania — panel szczegółów podaje
  // `targetUuids: [uuid]` (jeden, konkretny użytkownik), lista `erpBuildBatchTargets(scope)`
  // (zaznaczenie wielokrotne albo filtr „Zaznacz wszystko"); backend nie rozróżnia tych dwóch
  // ścieżek, więc frontend też nie musi. `removeRoleAsync`/`removePermissionAsync` zostają
  // jako jedyne metody w trybie `Commands: [command]` — odbieranie KONKRETNEGO, znanego grantu
  // nie jest naturalną operacją nad zaznaczeniem wielu wierszy (patrz uzasadnienie przy
  // `RoleOrchestrator`).

  public async removeRoleAsync(command: UserRemoveRoleCommand, queueID?: string): Promise<string> {
    return this._runSingleTargetCommand(
      (payload) => this._api.userRemoveRoleMultipleCommand(payload),
      command,
      IDENTITY_JOB_COMMAND_KEYS.removeRole,
      queueID,
    );
  }

  public async removePermissionAsync(command: UserRemovePermissionCommand, queueID?: string): Promise<string> {
    return this._runSingleTargetCommand(
      (payload) => this._api.userRemovePermissionMultipleCommand(payload),
      command,
      IDENTITY_JOB_COMMAND_KEYS.removePermission,
      queueID,
    );
  }

  public async addRoleMultipleAsync(
    payload: BatchCommandOfUserAddRoleCommandAndSearchUserAccountRequest,
    queueID?: string,
  ): Promise<string> {
    return this._runBatchCommand(
      (p) => this._api.userAddRoleMultipleCommand(p),
      payload,
      IDENTITY_JOB_COMMAND_KEYS.addRole,
      queueID,
    );
  }

  public async addPermissionMultipleAsync(
    payload: BatchCommandOfUserAddPermissionCommandAndSearchUserAccountRequest,
    queueID?: string,
  ): Promise<string> {
    return this._runBatchCommand(
      (p) => this._api.userAddPermissionMultipleCommand(p),
      payload,
      IDENTITY_JOB_COMMAND_KEYS.addPermission,
      queueID,
    );
  }

  public async execForceLogoutMultipleAsync(
    payload: BatchCommandOfUserExecForceLogoutCommandAndSearchUserAccountRequest,
    queueID?: string,
  ): Promise<string> {
    return this._runBatchCommand(
      (p) => this._api.userExecForceLogoutMultipleCommand(p),
      payload,
      IDENTITY_JOB_COMMAND_KEYS.execForceLogout,
      queueID,
    );
  }

  private async _runBatchCommand<TPayload extends { queueId?: string; uiMetadata?: string }>(
    call: (payload: TPayload) => Observable<BatchResult>,
    payload: TPayload,
    commandNameKey: string,
    queueID?: string,
  ): Promise<string> {
    const meta: JobMeta = { commandName: commandNameKey, timestamp: new Date() };

    try {
      const result = await withRequestId(() =>
        firstValueFrom(call({ ...payload, queueId: queueID, uiMetadata: JSON.stringify(meta) })),
      );
      const jobUuid = result.jobUuid || '';

      this.jobService.addJob(jobUuid, queueID, meta);

      return jobUuid;
    } catch (err) {
      this.addError({ operation: 'command', message: err instanceof Error ? err.message : String(err), timestamp: new Date() });
      throw err;
    }
  }

  /**
   * Wysyła komendę jako zadanie z JEDNYM elementem (tryb `Commands: [command]` kontraktu
   * `BatchCommand`) i rejestruje je w {@link JobService} — dokładnie tak samo jak wsad na wielu
   * celach, bo backend nie rozróżnia tych dwóch przypadków (patrz Faza 1+2 przejścia opisanego
   * w docs/backend/identity-bulk-migration.md). Wynik zadania (sukces, `aggregate_not_found`
   * itp.) przychodzi asynchronicznie przez dzwonek powiadomień, nie przez zwróconą wartość.
   */
  private async _runSingleTargetCommand<TCommand extends { uuid?: string }>(
    call: (payload: { commands: TCommand[]; queueId?: string; uiMetadata?: string }) => Observable<BatchResult>,
    command: TCommand,
    commandNameKey: string,
    queueID?: string,
  ): Promise<string> {
    const meta: JobMeta = { commandName: commandNameKey, aggregateUuid: command.uuid, timestamp: new Date() };

    try {
      const result = await withRequestId(() =>
        firstValueFrom(call({ commands: [command], queueId: queueID, uiMetadata: JSON.stringify(meta) })),
      );
      const jobUuid = result.jobUuid || '';

      this.jobService.addJob(jobUuid, queueID, meta);

      return jobUuid;
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
