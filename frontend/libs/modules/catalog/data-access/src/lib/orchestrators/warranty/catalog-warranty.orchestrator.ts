import { Injectable, inject } from '@angular/core';
import { BaseOrchestrator, LoadOptions } from '@erp/shared/data-access';
import { ProductWarrantyVM, WarrantyVM } from './warranty.view-model';
import { Observable } from 'rxjs';

import { CatalogClient, ProductWarrantyDto, SearchResponse, WarrantyDto, SearchWarrantyRequest } from '../../api-client';

@Injectable({
  providedIn: 'root'
})
export class CatalogWarrantyOrchestrator extends BaseOrchestrator<WarrantyDto, WarrantyVM, SearchWarrantyRequest, LoadOptions> {
  protected readonly signature = 'catalog.warranty';
  protected readonly orchestratorConfig = { signalrSignature: 'catalog.warranty', maxCacheSize: 5000 };

  private readonly apiClient = inject(CatalogClient);

  /**
   * Rozwiązuje listę przypisań produkt-gwarancja do obiektów ProductWarrantyVM,
   * łącząc bazową gwarancję z katalogu z okresem trwania przypisanym do produktu.
   */
  public resolveWarrantyVMs(assignments: ProductWarrantyDto[]): ProductWarrantyVM[] {
    const result: ProductWarrantyVM[] = [];
    for (const assignment of assignments) {
      const dtoSignal = this.identityMap.get(assignment.warrantyUuid);
      const dto = dtoSignal();
      if (dto) {
        result.push({
          ...this.mapToViewModel(dto),
          warrantyUuid: assignment.warrantyUuid,
          productDurationMonths: assignment.durationMonths,
        });
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
