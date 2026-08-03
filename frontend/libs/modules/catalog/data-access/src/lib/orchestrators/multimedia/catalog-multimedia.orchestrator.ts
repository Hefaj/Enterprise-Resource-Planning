import { Injectable, Signal, computed, inject } from '@angular/core';
import { BaseOrchestrator } from '@erp/shared/data-access';
import { MultimediaVM, MediaType } from './multimedia.view-model';
import { delay, Observable, of } from 'rxjs';

// Temporary DTO mock since it's not in the real API client yet
export interface MultimediaDto {
  uuid: string;
  productUuid: string;
  fileName: string;
  mediaType: string;
  thumbnailUrl: string | null;
  originalUrl: string;
  fileSize: number;
  mimeType: string;
  sortOrder: number;
  createdAt: string;
}

export interface SearchMultimediaRequest {
  productUuids?: string[];
  uuids?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class CatalogMultimediaOrchestrator extends BaseOrchestrator<MultimediaDto, MultimediaVM, SearchMultimediaRequest> {
  protected readonly signature = 'catalog.multimedia';
  protected readonly orchestratorConfig = { signalrSignature: 'catalog.multimedia', maxCacheSize: 5000 };

  // Store do łatwego wyszukiwania wg productUuid
  private readonly productMultimediaMap = computed(() => {
    const map = new Map<string, MultimediaVM[]>();
    for (const [_, dto] of this.identityMap.getAll()()) {
      const vm = this.mapToViewModel(dto);
      const existing = map.get(vm.productUuid) || [];
      existing.push(vm);
      map.set(vm.productUuid, existing);
    }
    // Sort within products
    for (const [key, value] of map.entries()) {
      value.sort((a, b) => a.sortOrder - b.sortOrder);
      map.set(key, value);
    }
    return map;
  });



  /**
   * Zwraca Signal zawierający multimedia przypisane do danego produktu.
   */
  public getByProductUuid(productUuid: string): Signal<MultimediaVM[]> {
    return computed(() => {
      return this.productMultimediaMap().get(productUuid) || [];
    });
  }

  /**
   * Pobiera multimedia dla konkretnego produktu z backendu (Mock)
   */
  public async loadByProductUuid(productUuid: string): Promise<void> {
    await this.loadByProductUuids([productUuid]);
  }

  /**
   * Pobiera multimedia dla wielu produktów narazkach z backendu (Mock)
   */
  public async loadByProductUuids(productUuids: string[]): Promise<void> {
    const request: SearchMultimediaRequest = { productUuids };
    await this.searchAsync(request);
  }

  protected fetchByUuids(uuids: string[]): Observable<MultimediaDto[]> {
    const mocks: MultimediaDto[] = [];
    for (const uuid of uuids) {
      const parts = uuid.split('-');
      if (parts.length >= 3) {
        const puuid = parts.slice(1, -1).join('-');
        const i = parseInt(parts[parts.length - 1], 10);
        mocks.push({
          uuid: uuid,
          productUuid: puuid,
          fileName: `File ${i + 1} for ${puuid.substring(0, 4)}.jpg`,
          mediaType: 'image',
          thumbnailUrl: 'https://picsum.photos/200',
          originalUrl: 'https://picsum.photos/800',
          fileSize: Math.floor(Math.random() * 5000000) + 100000,
          mimeType: 'image/jpeg',
          sortOrder: i,
          createdAt: new Date().toISOString()
        });
      }
    }
    return of(mocks).pipe(delay(500));
  }

  protected searchByFilters(filters: SearchMultimediaRequest): Observable<any> {
    const productUuids = filters.productUuids || [];
    const uuids: string[] = [];
    for (const puuid of productUuids) {
      const count = Math.floor(Math.random() * 6);
      for (let i = 0; i < count; i++) {
        uuids.push(`media-${puuid}-${i}`);
      }
    }
    return of({ uuids }).pipe(delay(500));
  }

  protected mapToViewModel(dto: MultimediaDto): MultimediaVM {
    return {
      uuid: dto.uuid,
      productUuid: dto.productUuid,
      fileName: dto.fileName,
      mediaType: (dto.mediaType as MediaType) || 'unknown',
      thumbnailUrl: dto.thumbnailUrl,
      originalUrl: dto.originalUrl,
      fileSize: dto.fileSize,
      mimeType: dto.mimeType,
      sortOrder: dto.sortOrder,
      createdAt: new Date(dto.createdAt),
    };
  }

  protected applySearchFilter(item: MultimediaVM, request: SearchMultimediaRequest): boolean {
    if (request.productUuids && request.productUuids.length > 0) {
      if (!request.productUuids.includes(item.productUuid)) {
        return false;
      }
    }
    if (request.uuids && request.uuids.length > 0) {
      if (!request.uuids.includes(item.uuid)) {
        return false;
      }
    }
    return true;
  }
}
