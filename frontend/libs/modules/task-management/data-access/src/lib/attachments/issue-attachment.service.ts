import { Injectable, Signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { withRequestId } from '@erp/shared/data-access';

import {
  GetIssueAttachmentsRequest,
  IssueAttachmentCreateCommand,
  IssueAttachmentDto,
  TaskManagementClient,
} from '../api-client';
import { IssueChildCache } from '../issue-child-cache';

/**
 * Ile plików wolno wgrać jednym żądaniem.
 *
 * Odbicie `IssueAttachmentOptions.MaxFilesPerRequest` — backend i tak odrzuci większą paczkę,
 * ale bez tego limitu odrzuciłby ją PO wydaniu biletów i po transferze bajtów. Serwer zostaje
 * jedynym rozstrzygającym; tutaj chodzi wyłącznie o to, żeby nie marnować łącza użytkownika.
 */
export const ISSUE_ATTACHMENT_MAX_FILES_PER_REQUEST = 20;

/** Sygnatura realtime — musi się zgadzać z `AggregateSignatures.TaskManagementIssueAttachment`. */
const SIGNATURE = 'taskmgmt.issue_attachment';

/**
 * Załączniki zgłoszenia — lista, wgrywanie, unieważnianie cache’u.
 *
 * <p>Cache i realtime dziedziczy po {@link IssueChildCache} (tam też uzasadnienie, dlaczego
 * to nie jest orkiestrator). Własne jest tu jedno: <b>wgrywanie idzie z pominięciem tego
 * serwisu jako pośrednika bajtów</b> — przeglądarka wysyła plik prosto do magazynu adresem
 * z biletu, a tutaj wraca dopiero rejestracja (`docs/guides/backend/media-storage.md`,
 * `GetIssueAttachmentUploadTicketsEndpoint`).</p>
 */
@Injectable({ providedIn: 'root' })
export class IssueAttachmentService extends IssueChildCache<IssueAttachmentDto> {
  protected override readonly label = 'IssueAttachmentService';
  protected override readonly signature = SIGNATURE;

  private readonly _api = inject(TaskManagementClient);

  public constructor() {
    super();
    this.watch([SIGNATURE]);
  }

  /** Załączniki zgłoszenia z cache’u, najstarsze pierwsze. */
  public attachmentsOf(issueUuid: string | null | undefined): Signal<readonly IssueAttachmentDto[]> {
    return this.itemsOf(issueUuid);
  }

  /**
   * Wgrywa pliki do zgłoszenia i zwraca uuidy założonych załączników.
   *
   * <p>Trzy kroki, w tej kolejności: bilety → transfer prosto do magazynu → rejestracja.
   * Rozmiaru ani typu MIME nie deklarujemy — backend odczyta je z magazynu, bo tylko tam jest
   * prawda o tym, co faktycznie doleciało (`IssueAttachment.CreateUploaded`).</p>
   *
   * <p><b>Wszystko albo nic.</b> Rejestracja całej paczki idzie jednym żądaniem w jednej
   * transakcji, pod jednym `X-Request-Id` — ponowienie po zerwanym połączeniu nie założy
   * załączników drugi raz.</p>
   *
   * @param onProgress wołane po każdym przesłanym pliku — `(przesłane, wszystkie)`.
   */
  public async uploadAsync(
    issueUuid: string,
    files: readonly File[],
    onProgress?: (uploaded: number, total: number) => void,
  ): Promise<readonly string[]> {
    if (files.length === 0) {
      return [];
    }

    if (files.length > ISSUE_ATTACHMENT_MAX_FILES_PER_REQUEST) {
      throw new Error(
        `Jednorazowo można wgrać najwyżej ${ISSUE_ATTACHMENT_MAX_FILES_PER_REQUEST} plików.`,
      );
    }

    const tickets = await firstValueFrom(
      this._api.getIssueAttachmentUploadTickets({ count: files.length }),
    );

    for (const [index, file] of files.entries()) {
      const response = await fetch(tickets[index].url, {
        method: 'PUT',
        body: file,
        // Typ jedzie nagłówkiem, ale NIE jest częścią podpisu (patrz MinioArtifactStore) —
        // magazyn zapisze go przy obiekcie i to on wróci potem w `mimeType` załącznika.
        headers: file.type ? { 'Content-Type': file.type } : undefined,
      });

      if (!response.ok) {
        throw new Error(`Nie udało się wgrać pliku ${file.name} (HTTP ${response.status}).`);
      }

      onProgress?.(index + 1, files.length);
    }

    const commands: IssueAttachmentCreateCommand[] = files.map((file, index) => ({
      // Uuid nadaje klient, bo edytor potrzebuje go natychmiast — zanim odpowiedź wróci,
      // musi wstawić w treść obrazek wskazujący na endpoint zawartości
      // (`IssueAttachmentCreateCommandEndpoint`).
      uuid: crypto.randomUUID(),
      issueUuid,
      artifactUuid: tickets[index].artifactUuid,
      fileName: file.name,
    }));

    const result = await withRequestId(() =>
      firstValueFrom(this._api.issueAttachmentCreateCommand({ commands })),
    );

    await this.loadAsync(issueUuid, true);

    return result.uuids;
  }

  protected override fetchAsync(issueUuid: string): Promise<readonly IssueAttachmentDto[]> {
    return firstValueFrom(this._api.getIssueAttachments({ issueUuid } as GetIssueAttachmentsRequest));
  }
}
