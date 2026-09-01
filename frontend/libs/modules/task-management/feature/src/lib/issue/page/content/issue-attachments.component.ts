import {
  ChangeDetectionStrategy,
  Component,
  Signal,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { TuiIcon } from '@taiga-ui/core';
import { TuiFileLike, TuiFiles } from '@taiga-ui/kit';

import {
  ErpButtonComponent,
  ErpButtonConfig,
  ErpGroupCardComponent,
  ErpGroupCardConfig,
  ErpMediaPreviewItem,
  ErpMediaPreviewService,
  ErpToastService,
  ErpTranslatePipe,
} from '@erp/shared/ui';
import {
  ISSUE_ATTACHMENT_MAX_FILES_PER_REQUEST,
  IssueAttachmentContentService,
  IssueAttachmentDto,
  IssueAttachmentService,
} from '@erp/task-management/data-access';

import { ISSUE_KEYS } from '../../translation';

/** Wiersz sekcji: DTO plus adres podglądu, który dojeżdża osobno. */
interface IssueAttachmentRow {
  readonly dto: IssueAttachmentDto;

  /** `blob:`-URL podglądu albo `undefined` — dla nieobrazów zawsze `undefined`. */
  readonly url: string | undefined;
}

/**
 * Załączniki zgłoszenia — lista plików pod opisem na karcie.
 *
 * <p><b>Pliki wgrywają się od razu po wybraniu, a nie przy jakimkolwiek „zapisz”</b> — karta
 * zgłoszenia nie ma przycisku zapisu całości, a rejestracja plików jest osobną komendą wobec
 * zmiany opisu. Ta sama decyzja co w kroku dodawania multimediów w Catalogu i z tego samego
 * powodu: transfer trwa tyle, ile łącze użytkownika, więc schowany za przyciskiem zamieniłby
 * kartę w zawieszony ekran bez informacji zwrotnej.</p>
 *
 * <p><b>Usuwania nie ma i nie jest to przeoczenie.</b> Backend nie wystawia komendy kasującej
 * załącznik: plik należy do zgłoszenia i znika razem z nim, w tej samej transakcji
 * (<c>IssueAttachment</c>, `docs/backend/media-storage.md` §4c). Przycisk „usuń” musiałby więc
 * wołać endpoint, którego nie ma — dokłada się go razem z komendą, nie wcześniej.</p>
 */
@Component({
  selector: 'erp-task-management-issue-attachments',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, TuiFiles, TuiIcon, ErpButtonComponent, ErpGroupCardComponent, ErpTranslatePipe],
  template: `
    <erp-group-card [config]="this.cardConfig()">
      <div class="flex flex-col gap-2">
        @if (canEdit()) {
          <label tuiInputFiles>
            <input
              tuiInputFiles
              multiple
              [formControl]="filesControl"
              [attr.aria-label]="ISSUE_KEYS.detail.attachments.add | erpTranslate"
            />
          </label>
        }

        @if (uploading()) {
          <p class="m-0 text-sm text-[var(--tui-text-secondary)]">
            {{ ISSUE_KEYS.detail.attachments.uploading | erpTranslate: { uploaded: uploaded(), total: total() } }}
          </p>
        }

        @if (rows().length === 0) {
          <p class="m-0 text-sm text-[var(--tui-text-secondary)]">
            {{ ISSUE_KEYS.detail.attachments.empty | erpTranslate }}
          </p>
        } @else {
          <ul class="m-0 flex list-none flex-wrap gap-3 p-0">
            @for (row of rows(); track row.dto.uuid) {
            <li class="flex w-72 items-center gap-3 rounded border border-[var(--tui-border-normal)] p-2">
              @if (row.dto.isImage) {
                <button
                  type="button"
                  class="h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded border-0 bg-[var(--tui-background-neutral-1)] p-0"
                  [attr.aria-label]="ISSUE_KEYS.detail.attachments.preview | erpTranslate"
                  (click)="openPreview(row.dto.uuid)"
                >
                  @if (row.url) {
                    <img [src]="row.url" [alt]="row.dto.fileName" class="h-full w-full object-cover" />
                  }
                </button>
              } @else {
                <!-- Ikona typu pliku zamiast udawanego podglądu: dokumentu ani archiwum
                     przeglądarka i tak by tu nie narysowała. -->
                <span
                  class="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-[var(--tui-background-neutral-1)] text-[var(--tui-text-secondary)]"
                  aria-hidden="true"
                >
                  <tui-icon icon="@tui.file" />
                </span>
              }

              <div class="flex min-w-0 flex-1 flex-col">
                <span class="truncate text-sm" [title]="row.dto.fileName">{{ row.dto.fileName }}</span>
                <span class="text-xs text-[var(--tui-text-secondary)]">
                  {{ formatSize(row.dto.fileSize) }} · {{ row.dto.createdAt | date: 'short' }}
                </span>
              </div>

              <erp-button [config]="downloadButton(row.dto)" />
            </li>
            }
          </ul>
        }
      </div>
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

  protected readonly filesControl = new FormControl<TuiFileLike | readonly TuiFileLike[] | null>(null);

  private readonly _selection = toSignal(this.filesControl.valueChanges, { initialValue: null });

  protected readonly uploading = signal<boolean>(false);
  protected readonly uploaded = signal<number>(0);
  protected readonly total = signal<number>(0);

  private readonly _list = computed(() => this._attachments.attachmentsOf(this.issueUuid())());

  /**
   * Adresy podglądu per załącznik. Trzymane w sygnale, bo powstają leniwie — pobranie zamawia
   * dopiero pojawienie się pozycji na liście, a kafelek dorysowuje się sam, gdy blob dojedzie.
   */
  private readonly _urls = signal<ReadonlyMap<string, Signal<string | undefined>>>(new Map());

  protected readonly rows = computed<IssueAttachmentRow[]>(() => {
    const urls = this._urls();
    return this._list().map((dto) => ({ dto, url: urls.get(dto.uuid)?.() }));
  });

  protected readonly cardConfig = computed<ErpGroupCardConfig>(() => ({
    title: { key: ISSUE_KEYS.detail.attachments.titleWithCount, params: { count: this.rows().length } },
    icon: '@tui.paperclip',
  }));

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

    effect(() => {
      const selection = this._selection();
      const files = selection === null ? [] : Array.isArray(selection) ? selection : [selection];

      untracked(() => void this._upload(files as File[]));
    });
  }

  protected downloadButton(dto: IssueAttachmentDto): ErpButtonConfig {
    return {
      label: ISSUE_KEYS.detail.attachments.download,
      appearance: 'flat',
      size: 'xs',
      iconStart: '@tui.download',
      fn: async (): Promise<void> => {
        if (!(await this._content.downloadAsync(dto))) {
          this._toasts.show({
            message: ISSUE_KEYS.detail.attachments.downloadFailed,
            appearance: 'negative',
          });
        }
      },
    };
  }

  /**
   * Otwiera podgląd na klikniętej pozycji. Do okna idą wyłącznie obrazy — przechodzenie
   * strzałkami przez pliki, których nie da się narysować, byłoby serią komunikatów o braku
   * podglądu.
   */
  protected openPreview(startId: string): void {
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

  protected formatSize(bytes: number): string {
    return formatSize(bytes);
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

  private async _upload(files: readonly File[]): Promise<void> {
    const issueUuid = this.issueUuid();

    if (!issueUuid || files.length === 0) {
      return;
    }

    if (files.length > ISSUE_ATTACHMENT_MAX_FILES_PER_REQUEST) {
      this._toasts.show({
        message: ISSUE_KEYS.detail.attachments.tooManyFiles,
        appearance: 'negative',
      });
      this.filesControl.setValue(null, { emitEvent: false });
      return;
    }

    this.uploading.set(true);
    this.uploaded.set(0);
    this.total.set(files.length);

    try {
      await this._attachments.uploadAsync(issueUuid, files, (uploaded) => this.uploaded.set(uploaded));
    } catch (error) {
      console.error('[IssueAttachmentsComponent] Nie udało się wgrać załączników.', error);
      this._toasts.show({
        message: ISSUE_KEYS.detail.attachments.uploadFailed,
        appearance: 'negative',
      });
    } finally {
      this.uploading.set(false);
      // Wybór czyścimy zawsze: lista pod spodem pokazuje już stan faktyczny, a zostawiony
      // wgrałby te same pliki jeszcze raz przy następnej zmianie kontrolki.
      this.filesControl.setValue(null, { emitEvent: false });
    }
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
