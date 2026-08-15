import { Injectable, inject } from '@angular/core';
import { BaseOrchestrator, LoadOptions, OrchestratorConfig } from '@erp/shared/data-access';
import { Observable } from 'rxjs';

import { CatalogClient, CodeTypeDto, SearchCodeTypeRequest, SearchResponse } from '../../api-client';
import { CodeTypeVM } from './code-type.view-model';

/**
 * Słownik typów kodów produktu (SKU, EAN, MPN…).
 *
 * Produkt nie niesie już kolumn `sku` i `ean` — niesie listę kodów, z których każdy wskazuje
 * na wiersz TEGO słownika. Bez niego z `ProductDto.codes` nie da się powiedzieć, który kod
 * jest którym.
 */
@Injectable({ providedIn: 'root' })
export class CatalogCodeTypeOrchestrator extends BaseOrchestrator<
  CodeTypeDto,
  CodeTypeVM,
  SearchCodeTypeRequest,
  LoadOptions
> {
  private readonly apiClient = inject(CatalogClient);

  // Gettery, nie pola — patrz uzasadnienie przy CatalogMultimediaOrchestrator.
  protected override get signature(): string {
    return 'catalog.codetype';
  }

  protected override get orchestratorConfig(): Partial<OrchestratorConfig> & { signalrSignature: string } {
    // Słownik liczy jednostki wierszy i praktycznie się nie zmienia — cache może objąć całość.
    return { signalrSignature: 'catalog.codetype', maxCacheSize: 500 };
  }

  /** Rozwiąż typ kodu po UUID z cache — `null`, dopóki nie doładowany. */
  public resolveCodeTypeVM(uuid: string): CodeTypeVM | null {
    const dto = this.identityMap.peek(uuid);
    return dto ? this.mapToViewModel(dto) : null;
  }

  protected override fetchByUuids(uuids: string[]): Observable<CodeTypeDto[]> {
    return this.apiClient.getCodeType({ uuids } as never);
  }

  protected override searchByFilters(filters: SearchCodeTypeRequest): Observable<SearchResponse> {
    return this.apiClient.searchCodeType(filters);
  }

  protected override mapToViewModel(dto: CodeTypeDto): CodeTypeVM {
    return { ...dto };
  }

  protected applySearchFilter(item: CodeTypeVM, request: SearchCodeTypeRequest): boolean {
    if (request.codeTypeId && item.uuid !== request.codeTypeId) {
      return false;
    }
    return true;
  }
}
