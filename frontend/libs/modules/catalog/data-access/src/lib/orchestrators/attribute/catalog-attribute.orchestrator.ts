import { Injectable, inject } from '@angular/core';
import { BaseOrchestrator, LoadOptions, OrchestratorConfig } from '@erp/shared/data-access';
import { Observable } from 'rxjs';

import {
  AttributeDefinitionDto,
  AttributeOptionDto,
  CatalogClient,
  SearchAttributeRequest,
  SearchResponse,
} from '../../api-client';
import { AttributeVM } from './attribute.view-model';

/**
 * Słownik definicji atrybutów produktu.
 *
 * `ProductDto.attributes[]` niesie samą wartość i wskazanie definicji — nazwa cechy, jej rodzaj
 * i etykieta wybranej pozycji słownikowej mieszkają tutaj. Definicje wchodzą razem z opcjami
 * (`getAttribute` zwraca je zagnieżdżone), więc rozwiązanie „Czarny” nie kosztuje drugiego
 * żądania.
 */
@Injectable({ providedIn: 'root' })
export class CatalogAttributeOrchestrator extends BaseOrchestrator<
  AttributeDefinitionDto,
  AttributeVM,
  SearchAttributeRequest,
  LoadOptions
> {
  private readonly apiClient = inject(CatalogClient);

  // Gettery, nie pola — patrz uzasadnienie przy CatalogMultimediaOrchestrator.
  protected override get signature(): string {
    return 'catalog.attribute';
  }

  protected override get orchestratorConfig(): Partial<OrchestratorConfig> & { signalrSignature: string } {
    return { signalrSignature: 'catalog.attribute', maxCacheSize: 500 };
  }

  /** Rozwiąż definicję atrybutu po UUID z cache — `null`, dopóki nie doładowana. */
  public resolveAttributeVM(uuid: string): AttributeVM | null {
    const dto = this.identityMap.peek(uuid);
    return dto ? this.mapToViewModel(dto) : null;
  }

  /**
   * Rozwiąż pozycję słownika po UUID. Szukanie idzie przez definicję, bo opcje nie mają
   * własnego endpointu — są częścią agregatu definicji.
   */
  public resolveOptionVM(attributeUuid: string, optionUuid: string): AttributeOptionDto | null {
    const attribute = this.identityMap.peek(attributeUuid);
    return attribute?.options?.find(option => option.uuid === optionUuid) ?? null;
  }

  protected override fetchByUuids(uuids: string[]): Observable<AttributeDefinitionDto[]> {
    return this.apiClient.getAttribute({ uuids } as never);
  }

  protected override searchByFilters(filters: SearchAttributeRequest): Observable<SearchResponse> {
    return this.apiClient.searchAttribute(filters);
  }

  protected override mapToViewModel(dto: AttributeDefinitionDto): AttributeVM {
    return { ...dto };
  }

  protected applySearchFilter(item: AttributeVM, request: SearchAttributeRequest): boolean {
    if (request.attributeId && item.uuid !== request.attributeId) {
      return false;
    }
    if (request.kind && item.kind !== request.kind) {
      return false;
    }
    return true;
  }
}
