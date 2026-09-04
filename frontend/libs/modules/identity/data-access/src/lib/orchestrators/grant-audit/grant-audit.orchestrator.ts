import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { BaseOrchestrator, LoadOptions, OrchestratorConfig } from '@erp/shared/data-access';
import { IdentityClient, GetGrantAuditRequest, SearchGrantAuditRequest, SearchResponse, GrantAuditDto } from '../../api-client';
import { GrantAuditVM } from './grant-audit.view-model';

/**
 * Orkiestrator dziennika audytu nadań (`grant_audit`) — append-only log kto/komu/co/kiedy
 * nadał lub odebrał (rola, uprawnienie), patrz `docs/architecture/integration-events.md`. Wyłącznie
 * do odczytu: brak komend, brak mutacji.
 *
 * `signalrSignature` nie odpowiada żadnej realnej sygnaturze `AggregateSignatures` na
 * backendzie — audyt jest append-only i strona historii nie musi się przeliczać na żywo,
 * wystarczy odświeżenie przy każdym wejściu/zmianie filtrów. Subskrypcja jest więc
 * nieszkodliwym no-opem (nigdy nie nadejdzie), nie realnym kanałem synchronizacji.
 */
@Injectable({ providedIn: 'root' })
export class GrantAuditOrchestrator extends BaseOrchestrator<
  GrantAuditDto,
  GrantAuditVM,
  SearchGrantAuditRequest,
  LoadOptions
> {
  private readonly _api = inject(IdentityClient);

  protected override get signature(): string {
    return 'identity.grantAudit';
  }

  protected override get orchestratorConfig(): Partial<OrchestratorConfig> & { signalrSignature: string } {
    return { signalrSignature: 'identity.grantAudit', maxCacheSize: 2000 };
  }

  protected override fetchByUuids(uuids: string[]): Observable<GrantAuditDto[]> {
    return this._api.getGrantAudit({ uuids } as GetGrantAuditRequest);
  }

  protected override searchByFilters(filters: SearchGrantAuditRequest): Observable<SearchResponse> {
    return this._api.searchGrantAudit(filters);
  }

  protected override mapToViewModel(dto: GrantAuditDto): GrantAuditVM {
    return { ...dto };
  }
}
