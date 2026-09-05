import { ChangeDetectionStrategy, Component, Signal, computed, effect, inject, input, signal, untracked } from '@angular/core';

import {
  ErpConfirmDialogService,
  ErpFileUploadListComponent,
  ErpFileUploadListBuilder,
  ErpFileUploadListConfig,
  ErpFileUploadListItem,
  ErpGroupCardComponent,
  ErpGroupCardConfig,
  ErpMediaPreviewItem,
  ErpMediaPreviewService,
  ErpToastService,
} from '@erp/shared/ui';
import {
  ISSUE_ATTACHMENT_MAX_FILES_PER_REQUEST,
  IssueAttachmentContentService,
  IssueAttachmentDto,
  IssueAttachmentService,
  TaskManagementIssueOrchestrator,
} from '@erp/task-management/data-access';

import { ISSUE_KEYS } from '../../translation';

/**
 * Załączniki zgłoszenia — lista plików pod opisem na karcie.
 *
 * Wybór/postęp/lista/błędy renderuje wspólny port `erp-file-upload-list` (shared/ui). Ten
 * komponent zostaje adapterem domenowym: zamienia DTO na `ErpFileUploadListItem`, dostarcza
 * bilet uploadu i komendy.
 *
 * <p><b>Pliki wgrywają się od razu po wybraniu, a nie przy jakimkolwiek „zapisz”</b> — karta
 * zgłoszenia nie ma przycisku zapisu całości, a rejestracja plików jest osobną komendą wobec
 * zmiany opisu. Ta sama decyzja co w kroku dodawania multimediów w Catalogu i z tego samego
 * powodu: transfer trwa tyle, ile łącze użytkownika, więc schowany za przyciskiem zamieniłby
 * kartę w zawieszony ekran bez informacji zwrotnej.</p>
 *
 * <p><b>Usunięcie pojedynczego załącznika (ATT-002)</b> kasuje wiersz od razu, a bajty w magazynie
 * sprząta konsument zdarzenia <c>ArtifactDeletionRequested</c> po zatwierdzeniu transakcji —
 * nigdy gołe wywołanie <c>DeleteAsync</c> z tego miejsca (`docs/guides/backend/media-storage.md` §4b).</p>
 */
@Component({
  selector: 'erp-task-management-issue-attachments',
  standalone: true,
  imports: [ErpGroupCardComponent, ErpFileUploadListComponent],
  template: `
    <erp-group-card [config]="cardConfig()">
      <erp-file-upload-list [config]="uploadListConfig()" />
    </erp-group-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueAttachmentsComponent {
  protected readonly ISSUE_KEYS = ISSUE_KEYS;

  /** Zgłoszenie, którego pliki pokazuje sekcja. `null`, dopóki karta nie rozwiąże go z klucza. */
  public readonly issueUuid = input.required<string | null>();

  /** Czy wolno dokładać pliki — uprawnienie liczy karta, nie ta sekcja. */
  public readonly canEdit = input<boolean>(false);

  private readonly _attachments = inject(IssueAttachmentService);
  private readonly _content = inject(IssueAttachmentContentService);
  private readonly _preview = inject(ErpMediaPreviewService);
  private readonly _toasts = inject(ErpToastService);
  private readonly _issues = inject(TaskManagementIssueOrchestrator);
  private readonly _confirm = inject(ErpConfirmDialogService);

  private readonly _list = computed(() => this._attachments.attachmentsOf(this.issueUuid())());

  /**
   * Adresy podglądu per załącznik. Trzymane w sygnale, bo powstają leniwie — pobranie zamawia
   * dopiero pojawienie się pozycji na liście, a kafelek dorysowuje się sam, gdy blob dojedzie.
   */
  private readonly _urls = signal<ReadonlyMap<string, Signal<string | undefined>>>(new Map());

  protected readonly items = computed<ErpFileUploadListItem[]>(() => {
    const urls = this._urls();
    return this._list().map((dto) => ({
      id: dto.uuid,
      fileName: dto.fileName,
      fileSize: dto.fileSize,
      createdAt: dto.createdAt,
      isImage: dto.isImage,
      previewUrl: urls.get(dto.uuid),
    }));
  });

  protected readonly cardConfig = computed<ErpGroupCardConfig>(() => ({
    title: { key: ISSUE_KEYS.detail.attachments.titleWithCount, params: { count: this.items().length } },
    icon: '@tui.paperclip',
  }));

  protected readonly uploadListConfig = computed<ErpFileUploadListConfig>(() =>
    ErpFileUploadListBuilder.create((b) =>
      b
        .setItems(this.items())
        .setCanEdit(this.canEdit())
        .setAddLabel(ISSUE_KEYS.detail.attachments.add)
        .setEmptyLabel(ISSUE_KEYS.detail.attachments.empty)
        .setPreviewLabel(ISSUE_KEYS.detail.attachments.preview)
        .setDownloadLabel(ISSUE_KEYS.detail.attachments.download)
        .setRemoveLabel(ISSUE_KEYS.detail.attachments.remove)
        .setUploadingLabel((uploaded, total) => ({ key: ISSUE_KEYS.detail.attachments.uploading, params: { uploaded, total } }))
        .setUploadFailedLabel(ISSUE_KEYS.detail.attachments.uploadFailed)
        .setTooManyFilesLabel(ISSUE_KEYS.detail.attachments.tooManyFiles)
        .setMaxFilesPerSelection(ISSUE_ATTACHMENT_MAX_FILES_PER_REQUEST)
        .setOnUpload((files, onProgress) => this._uploadAsync(files, onProgress))
        .setOnPreview((item) => this._openPreview(item.id))
        .setOnDownload((item) => this._downloadAsync(item.id))
        .setOnRemove((item) => this._removeAsync(item.id)),
    ),
  );

  public constructor() {
    effect(() => {
      const uuid = this.issueUuid();
      untracked(() => {
        if (uuid) {
          void this._attachments.loadAsync(uuid);
        }
      });
    });

    effect(() => {
      const list = this._list();

      // `untracked`, bo zamawianie adresów zapisuje sygnał, który ten sam effect czyta —
      // bez tego pierwszy zapis wywołałby go ponownie i zamówił pobrania drugi raz.
      untracked(() => this._ensureUrls(list));
    });
  }

  private async _downloadAsync(attachmentUuid: string): Promise<void> {
    const dto = this._list().find((candidate) => candidate.uuid === attachmentUuid);

    if (!dto) {
      return;
    }

    if (!(await this._content.downloadAsync(dto))) {
      this._toasts.show({
        message: ISSUE_KEYS.detail.attachments.downloadFailed,
        appearance: 'negative',
      });
    }
  }

  /** ATT-002 — usunięcie idzie przez prefiks postojowy/outbox po stronie backendu, nie przez
   * gołe kasowanie w magazynie; tutaj tylko potwierdzenie i wywołanie komendy. */
  private async _removeAsync(attachmentUuid: string): Promise<void> {
    const confirmed = await this._confirm.confirmAsync({
      title: ISSUE_KEYS.detail.attachments.removeConfirmTitle,
      message: ISSUE_KEYS.detail.attachments.removeConfirmMessage,
      confirmLabel: ISSUE_KEYS.detail.attachments.remove,
      appearance: 'destructive',
    });

    if (!confirmed) {
      return;
    }

    await this._issues.removeAttachmentAsync({ uuid: attachmentUuid });
  }

  /**
   * Otwiera podgląd na klikniętej pozycji. Do okna idą wyłącznie obrazy — przechodzenie
   * strzałkami przez pliki, których nie da się narysować, byłoby serią komunikatów o braku
   * podglądu.
   */
  private _openPreview(startId: string): void {
    const urls = this._urls();

    const items: ErpMediaPreviewItem[] = this._list()
      .filter((dto) => dto.isImage)
      .map((dto) => ({
        id: dto.uuid,
        fileName: dto.fileName,
        caption: formatSize(dto.fileSize),
        url: urls.get(dto.uuid) ?? signal<string | undefined>(undefined),
        renderable: true,
      }));

    if (items.length === 0) {
      return;
    }

    this._preview
      .open({
        items,
        startId,
        unavailableMessage: ISSUE_KEYS.detail.attachments.previewUnavailable,
        onDownload: async (item: ErpMediaPreviewItem): Promise<void> => {
          const dto = this._list().find((candidate) => candidate.uuid === item.id);

          if (dto) {
            await this._content.downloadAsync(dto);
          }
        },
      })
      .subscribe();
  }

  private _ensureUrls(list: readonly IssueAttachmentDto[]): void {
    const current = this._urls();
    const missing = list.filter((dto) => dto.isImage && !current.has(dto.uuid));

    if (missing.length === 0) {
      return;
    }

    const next = new Map(current);
    for (const dto of missing) {
      next.set(dto.uuid, this._content.contentUrl(dto.uuid));
    }

    this._urls.set(next);
  }

  private async _uploadAsync(files: readonly File[], onProgress: (uploaded: number) => void): Promise<void> {
    const issueUuid = this.issueUuid();

    if (!issueUuid) {
      return;
    }

    await this._attachments.uploadAsync(issueUuid, files, onProgress);
  }
}

/** Rozmiar pliku w jednostkach czytelnych dla człowieka. Dane, nie klucz tłumaczenia. */
function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}
