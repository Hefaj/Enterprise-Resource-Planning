import { Injectable, Signal, computed, inject } from '@angular/core';
import { BaseOrchestrator, OrchestratorConfig } from '@erp/shared/data-access';
import { MultimediaVM } from './multimedia.view-model';
import { firstValueFrom, Observable } from 'rxjs';

import { CatalogClient, SearchResponse, MultimediaDto, SearchMultimediaRequest, MultimediaCreateCommand } from '../../api-client';

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



  /**
   * Wgrywa pliki i rejestruje je w katalogu. Zwraca uuidy zasobów, gotowe do dopięcia
   * do produktów (`CatalogProductOrchestrator.addMultimediaMultiple`).
   *
   * Trzy kroki, w tej kolejności:
   * 1. bilety — po jednym adresie `PUT` na plik,
   * 2. transfer **prosto do magazynu**, z pominięciem naszego API,
   * 3. rejestracja w katalogu (synchroniczna, bo uuidy są potrzebne od razu).
   *
   * <b>Krok 2 świadomie omija `HttpClient`.</b> Adres jest podpisem magazynu, a nie żądaniem
   * do naszego serwisu: `erpClientIdInterceptor` dokłada do każdego żądania nagłówek
   * `X-Client-Id`, którego MinIO nie ma na białej liście CORS — preflight odbiłby transfer.
   * `fetch` nie przechodzi przez interceptory Angulara, więc problem znika u źródła.
   *
   * @param files Pliki wybrane przez użytkownika.
   * @param onProgress Wołane po każdym wgranym pliku — do paska postępu w modalu.
   */
  public async uploadFiles(
    files: readonly File[],
    onProgress?: (uploaded: number, total: number) => void,
  ): Promise<string[]> {
    if (files.length === 0) {
      return [];
    }

    try {
      const tickets = await firstValueFrom(
        this.apiClient.getMultimediaUploadTickets({ count: files.length }),
      );

      for (const [index, file] of files.entries()) {
        const response = await fetch(tickets[index].uploadUrl, {
          method: 'PUT',
          body: file,
          // Typ jedzie nagłówkiem, ale NIE jest częścią podpisu (patrz MinioArtifactStore) —
          // magazyn zapisze go przy obiekcie i to on wróci potem w `mimeType` zasobu.
          headers: file.type ? { 'Content-Type': file.type } : undefined,
        });

        if (!response.ok) {
          throw new Error(`Nie udało się wgrać pliku ${file.name} (HTTP ${response.status}).`);
        }

        onProgress?.(index + 1, files.length);
      }

      // Rozmiaru ani typu tu nie deklarujemy: backend odczyta je z magazynu, bo tylko tam jest
      // prawda o tym, co faktycznie doleciało (patrz MultimediaAsset.CreateUploaded).
      const commands: MultimediaCreateCommand[] = files.map((file, index) => ({
        uuid: crypto.randomUUID(),
        artifactUuid: tickets[index].artifactUuid,
        fileName: file.name,
        sortOrder: index,
      }));

      const result = await firstValueFrom(this.apiClient.multimediaCreateCommand({ commands }));

      return result.uuids;
    } catch (err) {
      this.addError({
        operation: 'command',
        message: err instanceof Error ? err.message : String(err),
        timestamp: new Date(),
      });
      throw err;
    }
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
