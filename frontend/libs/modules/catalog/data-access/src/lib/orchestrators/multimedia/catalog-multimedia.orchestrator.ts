import { Injectable, Signal, computed, inject } from '@angular/core';
import { BaseOrchestrator } from '@erp/shared/data-access';
import { MultimediaVM, MediaType } from './multimedia.view-model';
import { delay, Observable, of } from 'rxjs';

import { CatalogClient, SearchResponse, MultimediaDto, SearchMultimediaRequest } from '../../api-client';

@Injectable({
  providedIn: 'root'
})
export class CatalogMultimediaOrchestrator extends BaseOrchestrator<MultimediaDto, MultimediaVM, SearchMultimediaRequest> {
  protected readonly signature = 'catalog.multimedia';
  protected readonly orchestratorConfig = { signalrSignature: 'catalog.multimedia', maxCacheSize: 5000 };

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
      mediaType: (dto.mediaType as MediaType) || 'unknown',
      thumbnailUrl: dto.thumbnailUrl ?? null,
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
