import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { BaseOrchestrator, LoadOptions, OrchestratorConfig } from '@erp/shared/data-access';
import { IdentityClient, PermissionCatalogEntryDto } from '../../api-client';
import { PermissionCatalogItemDto, PermissionCatalogVM } from './permission-catalog.view-model';

/**
 * Katalog uprawnień — read-only przeglądarka (`docs/architecture/security.md` §3). Backend
 * celowo nie paginuje `searchPermissionCatalog()` (dziesiątki, nie tysiące wpisów), więc
 * `fetchByUuids`/`searchByFilters` obie po prostu wołają ten sam endpoint i filtrują/mapują
 * lokalnie — nie ma osobnego "get po id" ani realnych filtrów wyszukiwania po stronie API.
 *
 * Kwalifikuje się do orkiestratora (test z orchestrators.md §9): osobny endpoint, niezależny
 * lazy-load (strona `/identity/permissions`), współdzielony przez ≥2 konsumentów (ta strona +
 * pickery uprawnień przy nadawaniu roli/użytkownikowi).
 */
@Injectable({ providedIn: 'root' })
export class PermissionCatalogOrchestrator extends BaseOrchestrator<
  PermissionCatalogItemDto,
  PermissionCatalogVM,
  void,
  LoadOptions
> {
  private readonly _api = inject(IdentityClient);

  protected override readonly signature = 'identity.permissionCatalog';

  protected override readonly orchestratorConfig: Partial<OrchestratorConfig> & { signalrSignature: string } = {
    // Katalog uprawnień jest de facto statyczny w trakcie sesji admina (definiowany w kodzie,
    // patrz §3 dokumentu) — sygnatura istnieje formalnie, ale nic po niej realnie nie przyjdzie,
    // dokładnie jak w `GrantAuditOrchestrator`.
    signalrSignature: 'identity.permissionCatalog',
    maxCacheSize: 500,
  };

  private _toItemDto(entry: PermissionCatalogEntryDto): PermissionCatalogItemDto {
    return { ...entry, uuid: entry.code };
  }

  protected override fetchByUuids(uuids: string[]): Observable<PermissionCatalogItemDto[]> {
    const codes = new Set(uuids);
    return this._api
      .searchPermissionCatalog()
      .pipe(map((entries) => entries.filter((e) => codes.has(e.code)).map((e) => this._toItemDto(e))));
  }

  protected override searchByFilters(): Observable<{ uuids: string[]; totalCount: number }> {
    return this._api.searchPermissionCatalog().pipe(
      map((entries) => ({ uuids: entries.map((e) => e.code), totalCount: entries.length })),
    );
  }

  protected override mapToViewModel(dto: PermissionCatalogItemDto): PermissionCatalogVM {
    return dto;
  }

  /** Ładuje cały katalog naraz — jedyny sensowny sposób konsumpcji tego agregatu. */
  public async loadAllAsync(): Promise<PermissionCatalogVM[]> {
    const { uuids } = await this.searchAsync(undefined);
    const vmMap = this.getViewModel()();
    return (uuids ?? []).map((code) => vmMap.get(code)).filter((vm): vm is PermissionCatalogVM => vm !== undefined);
  }
}
