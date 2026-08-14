import { Injectable, inject } from '@angular/core';
import { BaseOrchestrator, LoadOptions, OrchestratorConfig } from '@erp/shared/data-access';
import { WarrantyVM } from './warranty.view-model';
import { Observable } from 'rxjs';

import { CatalogClient, SearchResponse, WarrantyDto, SearchWarrantyRequest } from '../../api-client';

@Injectable({
  providedIn: 'root'
})
export class CatalogWarrantyOrchestrator extends BaseOrchestrator<WarrantyDto, WarrantyVM, SearchWarrantyRequest, LoadOptions> {
  // Gettery, nie pola — patrz uzasadnienie przy CatalogMultimediaOrchestrator.
  protected override get signature(): string {
    return 'catalog.warranty';
  }

  protected override get orchestratorConfig(): Partial<OrchestratorConfig> & { signalrSignature: string } {
    return { signalrSignature: 'catalog.warranty', maxCacheSize: 5000 };
  }

  private readonly apiClient = inject(CatalogClient);

  /**
   * Rozwiąż pojedynczą katalogową gwarancję po UUID z cache — `null`, dopóki nie doładowana.
   */
  public resolveWarrantyVM(uuid: string): WarrantyVM | null {
    const dto = this.identityMap.peek(uuid);
    return dto ? this.mapToViewModel(dto) : null;
  }

  protected fetchByUuids(uuids: string[]): Observable<WarrantyDto[]> {
    return this.apiClient.getWarranty({ uuids } as any);
  }

  protected searchByFilters(filters: SearchWarrantyRequest): Observable<SearchResponse> {
    return this.apiClient.searchWarranty(filters);
  }

  protected mapToViewModel(dto: WarrantyDto): WarrantyVM {
    return { ...dto };
  }

  protected applySearchFilter(item: WarrantyVM, request: SearchWarrantyRequest): boolean {
    if (request.warrantyId) {
      if (item.uuid !== request.warrantyId) {
        return false;
      }
    }
    return true;
  }
}
