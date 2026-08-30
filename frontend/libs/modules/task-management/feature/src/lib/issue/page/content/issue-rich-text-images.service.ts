import { Injectable, inject, signal } from '@angular/core';
import { Observable, from, map, throwError } from 'rxjs';

import { IssueAttachmentContentService, IssueAttachmentService } from '@erp/task-management/data-access';

/**
 * Most między edytorem HTML a załącznikami zgłoszenia.
 *
 * Edytor dostaje `blob:`-URL, dzięki czemu może narysować obrazek za autoryzacją. Do modelu
 * formularza wraca jednak trwały adres endpointu zawartości; tylko ten adres wolno zapisać
 * w opisie lub komentarzu.
 */
@Injectable()
export class IssueRichTextImagesService {
  private readonly _attachments = inject(IssueAttachmentService);
  private readonly _content = inject(IssueAttachmentContentService);

  private readonly _issueUuid = signal<string | null>(null);
  private readonly _persistentByDisplayUrl = new Map<string, string>();

  public readonly valueTransformer = {
    fromControlValue: (value: string | null): string => this.fromControlValue(value),
    toControlValue: (value: unknown): string => this.toControlValue(value),
  };

  public setIssueUuid(issueUuid: string | null): void {
    this._issueUuid.set(issueUuid);
  }

  /** Loader przekazywany do `TUI_IMAGE_LOADER`; obsługuje wybór pliku i wklejenie ze schowka. */
  public loadImage(file: File | Blob): Observable<string> {
    const issueUuid = this._issueUuid();

    if (!issueUuid) {
      return throwError(() => new Error('Brak kontekstu zgłoszenia dla obrazka.'));
    }

    const uploadFile = this._toUploadFile(file);

    return from(this._attachments.uploadAsync(issueUuid, [uploadFile])).pipe(
      map(([uuid]) => {
        const displayUrl = this._content.cacheUploadedContent(uuid, uploadFile);
        this._persistentByDisplayUrl.set(displayUrl, this._content.apiUrlFromUuid(uuid));
        return displayUrl;
      }),
    );
  }

  /**
   * Taiga zwraca plik wybrany z dysku jako `File`, ale screenshot ze schowka jako `Blob`.
   * Serwis załączników potrzebuje nazwy pliku do rejestracji artefaktu, dlatego nadajemy ją
   * lokalnie — bajty i typ MIME pozostają niezmienione.
   */
  private _toUploadFile(file: File | Blob): File {
    if (file instanceof File) {
      return file;
    }

    const subtype = file.type.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'png';
    return new File([file], `clipboard-image-${crypto.randomUUID()}.${subtype}`, {
      type: file.type || 'image/png',
    });
  }

  /** Zamienia zapisane adresy API na `blob:` w podglądzie; odczyt sygnałów odświeża widok. */
  public displayHtml(html: string | null | undefined): string {
    if (!html) {
      return '';
    }

    return html.replace(/(<img\b[^>]*\bsrc=["'])([^"']+)(["'][^>]*>)/gi, (_match, before: string, source: string, after: string) => {
      const uuid = this._content.uuidFromApiUrl(source);

      if (!uuid) {
        return `${before}${source}${after}`;
      }

      const displayUrl = this._content.contentUrl(uuid)();
      if (!displayUrl) {
        return `${before}${source}${after}`;
      }

      this._persistentByDisplayUrl.set(displayUrl, source);
      return `${before}${displayUrl}${after}`;
    });
  }

  /** Transformacja wejścia dla Tui: istniejące obrazki pokazujemy, gdy URL jest już w cache. */
  public fromControlValue(value: string | null): string {
    return this.displayHtml(value);
  }

  /** Transformacja wyjścia dla Tui: `blob:` nigdy nie trafia do API ani bazy danych. */
  public toControlValue(value: unknown): string {
    const html = typeof value === 'string' ? value : '';

    return html.replace(/(<img\b[^>]*\bsrc=["'])(blob:[^"']+)(["'][^>]*>)/gi, (_match, before: string, displayUrl: string, after: string) => {
      const persistentUrl = this._persistentByDisplayUrl.get(displayUrl);
      return persistentUrl ? `${before}${persistentUrl}${after}` : `${before}${displayUrl}${after}`;
    });
  }
}
