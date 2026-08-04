import { Injectable, inject } from '@angular/core';
import { BaseOrchestrator, LoadOptions } from '@erp/shared/data-access';
import { WarrantyVM } from './warranty.view-model';
import { Observable } from 'rxjs';

import { CatalogClient, SearchResponse, WarrantyDto, SearchWarrantyRequest } from '../../api-client';

@Injectable({
  providedIn: 'root'
})
export class CatalogWarrantyOrchestrator extends BaseOrchestrator<WarrantyDto, WarrantyVM, SearchWarrantyRequest, LoadOptions> {
  protected readonly signature = 'catalog.warranty';
  protected readonly orchestratorConfig = { signalrSignature: 'catalog.warranty', maxCacheSize: 5000 };

  private readonly apiClient = inject(CatalogClient);

  /**
   * Rozwiązuje listę UUID gwarancji do obiektów WarrantyVM.
   */
  public resolveWarrantyVMs(uuids: string[]): WarrantyVM[] {
    const result: WarrantyVM[] = [];
    for (const uuid of uuids) {
      const dtoSignal = this.identityMap.get(uuid);
      const dto = dtoSignal();
      if (dto) {
        result.push(this.mapToViewModel(dto));
      }
    }
    return result;
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
