import { Injectable, Signal, computed, inject } from '@angular/core';
import { BaseOrchestrator, OrchestratorConfig } from '@erp/shared/data-access';
import { CATALOG_JOB_COMMAND_KEYS } from '@erp/catalog/util';
import { MultimediaVM } from './multimedia.view-model';
import { firstValueFrom, Observable } from 'rxjs';

import {
  BatchCommandOfMultimediaExecGenerateDerivativesCommandAndSearchMultimediaRequest,
  BatchCommandOfMultimediaRemoveCommandAndSearchMultimediaRequest,
  CatalogClient,
  SearchResponse,
  MultimediaDto,
  SearchMultimediaRequest,
  MultimediaCreateCommand,
} from '../../api-client';

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
   * do produktów (`CatalogProductOrchestrator.addMultimediaMultipleAsync`).
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
  public async uploadFilesAsync(
    files: readonly File[],
    onProgress?: (uploaded: number, total: number) => void,
  ): Promise<string[]> {
    if (files.length === 0) {
      return [];
    }

    // Bilety i transfer NIE idą przez `runDirectCommandAsync`: pierwszy jest odczytem podpisów,
    // drugi w ogóle nie jest żądaniem do naszego API (patrz akapit o `fetch` wyżej), więc nie ma
    // tu czego uczynić idempotentnym. Wspólny jest wyłącznie los błędu — wpis w stanie
    // orkiestratora i wyjątek dalej, dokładnie jak przy komendach.
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

      // Rejestracja jest już komendą — i jedyną tutaj, która tworzy stan po stronie serwera.
      // Zadania masowego nie zakłada (uuidy są potrzebne od razu, synchronicznie), więc idzie
      // wariantem „direct”: zakres `X-Request-Id` bez wpisu w feedzie powiadomień.
      const result = await this.runDirectCommandAsync(() =>
        this.apiClient.multimediaCreateCommand({ commands }),
      );

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

  /**
   * Usuwa zasoby z biblioteki mediów — <b>razem z plikami w magazynie</b>.
   *
   * To jest operacja inna niż odpięcie zdjęcia od produktu
   * (`CatalogProductOrchestrator.removeMultimediaMultipleAsync`): tamta zostawia zasób w katalogu,
   * ta go z niego wymazuje. Backend odmawia usunięcia zasobu, na który wskazuje choćby jeden
   * produkt (`multimedia_still_referenced`) — element odpada pojedynczo, reszta paczki
   * przechodzi (`docs/backend/media-storage.md` §4c).
   *
   * Plik w magazynie kasuje osobny konsument, po zatwierdzeniu transakcji, więc powodzenie
   * zadania oznacza „wiersz zniknął i zlecenie skasowania pliku jest utrwalone", a nie
   * „bajtów już nie ma".
   */
  public removeMultipleAsync(
    command: BatchCommandOfMultimediaRemoveCommandAndSearchMultimediaRequest,
    queueId?: string,
  ): Promise<string> {
    return this.runBatchCommandAsync(p => this.apiClient.multimediaRemoveCommand(p), command, {
      commandName: CATALOG_JOB_COMMAND_KEYS.removeAsset,
      queueId,
    });
  }

  /**
   * Zleca ponowne wygenerowanie miniaturki i podglądu dla wskazanych zasobów.
   *
   * Potrzebne dla zasobów wgranych, zanim generator zaczął działać: zlecenie wychodzi normalnie
   * raz, przy rejestracji pliku, i nigdy się nie powtarza, więc bez tej akcji jedynym sposobem
   * nadrobienia byłoby wgranie plików od nowa.
   *
   * <b>Zadanie kończy się na przyjęciu zleceń, nie na gotowych plikach.</b> Warianty powstają
   * asynchronicznie i zgłaszają się osobno, przez `AggregateChanged` — galeria podmieni wtedy
   * zaślepkę na miniaturkę sama, bez odpytywania w pętli.
   */
  public generateDerivativesMultipleAsync(
    command: BatchCommandOfMultimediaExecGenerateDerivativesCommandAndSearchMultimediaRequest,
    queueId?: string,
  ): Promise<string> {
    return this.runBatchCommandAsync(
      p => this.apiClient.multimediaExecGenerateDerivativesMultipleCommand(p),
      command,
      { commandName: CATALOG_JOB_COMMAND_KEYS.generateDerivatives, queueId },
    );
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
      hasDerivatives: dto.hasDerivatives,
      referenceCount: dto.referenceCount,
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
