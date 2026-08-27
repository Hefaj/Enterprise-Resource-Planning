import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

import { SignalrSyncService, withRequestId } from '@erp/shared/data-access';

import {
  GetIssueAttachmentsRequest,
  IssueAttachmentCreateCommand,
  IssueAttachmentDto,
  TaskManagementClient,
} from '../api-client';

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
 * Załączniki zgłoszenia — lista, wgrywanie, unieważnianie cache.
 *
 * <p><b>Dlaczego zwykły serwis, a nie orkiestrator</b> — ten sam powód co przy
 * {@link ProjectWorkflowService}: `BaseOrchestrator` stoi na wyszukiwaniu i cache'u tożsamości
 * po uuid, a załączniki czyta się kompletem per zgłoszenie i backend nie wystawia dla nich
 * żadnego `searchIssueAttachment`. Użycie orkiestratora wymagałoby udawania wyszukiwania,
 * którego nie ma.</p>
 *
 * <p><b>Wgrywanie idzie z pominięciem tego serwisu jako pośrednika bajtów</b>: przeglądarka
 * wysyła plik prosto do magazynu adresem z biletu, a tutaj wraca dopiero rejestracja
 * (`docs/backend/media-storage.md`, `GetIssueAttachmentUploadTicketsEndpoint`).</p>
 */
@Injectable({ providedIn: 'root' })
export class IssueAttachmentService {
  private readonly _api = inject(TaskManagementClient);
  private readonly _signalr = inject(SignalrSyncService);

  private readonly _byIssue = signal<ReadonlyMap<string, readonly IssueAttachmentDto[]>>(new Map());
  private readonly _inFlight = new Map<string, Promise<readonly IssueAttachmentDto[]>>();

  public constructor() {
    this._signalr.subscribe(SIGNATURE);

    // Zdarzenie niesie uuidy ZAŁĄCZNIKÓW, a cache jest trzymany per ZGŁOSZENIE — mapowania
    // w drugą stronę front nie ma i nie ma po co dokładać. Odświeżamy więc listy, które
    // ktoś faktycznie ogląda; w praktyce jest to jedna otwarta karta zgłoszenia.
    this._signalr
      .onUpdate(SIGNATURE)
      .pipe(takeUntilDestroyed())
      .subscribe(() => void this._refreshCached());

    this._signalr
      .onDelete(SIGNATURE)
      .pipe(takeUntilDestroyed())
      .subscribe(() => void this._refreshCached());
  }

  /**
   * Załączniki zgłoszenia z cache — nie odpala żądania (do tego jest {@link loadAsync}).
   * Pusta lista jest poprawnym stanem przejściowym: sekcja renderuje się bez pozycji zamiast
   * blokować kartę do czasu odpowiedzi.
   */
  public attachmentsOf(issueUuid: string | null | undefined): Signal<readonly IssueAttachmentDto[]> {
    return computed(() => (issueUuid ? (this._byIssue().get(issueUuid) ?? []) : []));
  }

  /**
   * Dociąga listę załączników. Równoległe wywołania dla tego samego zgłoszenia dzielą jedno
   * żądanie; `force` pomija cache po wgraniu plików.
   */
  public async loadAsync(issueUuid: string, force = false): Promise<readonly IssueAttachmentDto[]> {
    if (!issueUuid) {
      return [];
    }

    if (!force) {
      const cached = this._byIssue().get(issueUuid);
      if (cached) {
        return cached;
      }

      const pending = this._inFlight.get(issueUuid);
      if (pending) {
        return pending;
      }
    }

    const request = this._fetch(issueUuid).finally(() => this._inFlight.delete(issueUuid));
    this._inFlight.set(issueUuid, request);
    return request;
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

  /** Wyrzuca listę z cache — dla jednego zgłoszenia albo dla wszystkich. */
  public invalidate(issueUuid?: string): void {
    this._byIssue.update((map) => {
      if (!issueUuid) {
        return new Map();
      }
      const next = new Map(map);
      next.delete(issueUuid);
      return next;
    });
  }

  private async _fetch(issueUuid: string): Promise<readonly IssueAttachmentDto[]> {
    try {
      const attachments = await firstValueFrom(
        this._api.getIssueAttachments({ issueUuid } as GetIssueAttachmentsRequest),
      );

      this._byIssue.update((map) => new Map(map).set(issueUuid, attachments));
      return attachments;
    } catch (error) {
      // Brak dostępu do zgłoszenia wraca jako 404 — to nie jest awaria widoku, tylko granica
      // widoczności. Karta pokaże sekcję pustą, a nie komunikat o błędzie.
      console.error('[IssueAttachmentService] Nie udało się pobrać załączników zgłoszenia.', error);
      return [];
    }
  }

  private async _refreshCached(): Promise<void> {
    await Promise.all([...this._byIssue().keys()].map((issueUuid) => this.loadAsync(issueUuid, true)));
  }
}
