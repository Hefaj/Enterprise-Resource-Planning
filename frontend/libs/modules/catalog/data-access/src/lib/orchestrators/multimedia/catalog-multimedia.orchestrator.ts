import { Injectable, Signal, computed, inject } from '@angular/core';
import { BaseOrchestrator, OrchestratorConfig } from '@erp/shared/data-access';
import { MultimediaVM } from './multimedia.view-model';
import { delay, Observable, of } from 'rxjs';

import { CatalogClient, SearchResponse, MultimediaDto, SearchMultimediaRequest } from '../../api-client';

@Injectable({
  providedIn: 'root'
})
export class CatalogMultimediaOrchestrator extends BaseOrchestrator<MultimediaDto, MultimediaVM, SearchMultimediaRequest> {
  // Gettery, nie pola: BaseOrchestrator czyta `orchestratorConfig`/`signature` w SWOIM
  // konstruktorze, a inicjalizatory pól klasy pochodnej uruchamiają się dopiero PO powrocie
  // z super() — pole miałoby wtedy wartość `undefined` w chwili odczytu. Getter jest metodą
  // na prototypie, dostępną natychmiast. Patrz to samo zastrzeżenie przy pozostałych orkiestratorach.
  protected override get signature(): string {
    return 'catalog.multimedia';
  }

  protected override get orchestratorConfig(): Partial<OrchestratorConfig> & { signalrSignature: string } {
    return { signalrSignature: 'catalog.multimedia', maxCacheSize: 5000 };
  }

  private readonly apiClient = inject(CatalogClient);

  /**
   * Rozwiązuje listę UUID multimediów do obiektów MultimediaVM.
   */
  public resolveMultimediaVMs(uuids: string[]): MultimediaVM[] {
    const result: MultimediaVM[] = [];
    for (const uuid of uuids) {
      const dtoSignal = this.identityMap.get(uuid);
      const dto = dtoSignal();
      if (dto) {
        result.push(this.mapToViewModel(dto));
      }
    }
    return result;
  }



  protected fetchByUuids(uuids: string[]): Observable<MultimediaDto[]> {
    return this.apiClient.getMultimedia({ uuids } as any);
  }

  protected searchByFilters(filters: SearchMultimediaRequest): Observable<SearchResponse> {
    return this.apiClient.searchMultimedia(filters);
  }

  protected mapToViewModel(dto: MultimediaDto): MultimediaVM {
    return {
      uuid: dto.uuid,
      fileName: dto.fileName,
      mediaType: dto.mediaType || 'unknown',
      thumbnailUrl: dto.thumbnailUrl,
      originalUrl: dto.originalUrl,
      fileSize: dto.fileSize,
      mimeType: dto.mimeType,
      sortOrder: dto.sortOrder,
      createdAt: new Date(dto.createdAt),
    };
  }

  protected applySearchFilter(item: MultimediaVM, request: SearchMultimediaRequest): boolean {
    if (request.uuids && request.uuids.length > 0) {
      if (!request.uuids.includes(item.uuid)) {
        return false;
      }
    }
    return true;
  }
}
