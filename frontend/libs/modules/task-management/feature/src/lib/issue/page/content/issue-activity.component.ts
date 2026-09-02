import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { TranslocoService } from '@jsverse/transloco';

import {
  ErpButtonComponent,
  ErpButtonConfig,
  ErpConfirmDialogService,
  ErpRichTextBuilder,
  ErpRichTextComponent,
  ErpRichTextConfig,
  ErpUserPickerComponent,
  injectTranslationsReadySignal,
} from '@erp/shared/ui';
import { ERP_USER_DIRECTORY } from '@erp/shared/util';
import { ErpAuthService } from '@erp/shared/auth';
import {
  IssueActivityDto,
  IssueActivityService,
  IssueAttachmentContentService,
  IssueAttachmentService,
  IssueCommentDto,
  IssueCommentService,
  TaskManagementIssueOrchestrator,
  canonicalizeIssueRichTextHtml,
  createIssueRichTextUploadPort,
  insertOptimisticItem,
  replaceOptimisticItem,
  resolveIssueRichTextHtmlAsync,
} from '@erp/task-management/data-access';
import { ISSUE_ACTIVITY_KIND } from '@erp/task-management/util';
import { ErpActivityStreamComponent, ErpActivityStreamEntry } from '@erp/task-management/ui';

import { ISSUE_KEYS } from '../../translation';

/**
 * Wrapper `feature` nad `erp-activity-stream` (`ui`) — łączy komentarze i historię w jeden
 * strumień (`docs/frontend/task-management-pages.md` §9.1, decyzja 2). Cała logika komend,
 * cache’u i zdarzeń realtime zostaje tutaj; atom w `ui` tylko renderuje i filtruje.
 *
 * <p><b>Kolejność w strumieniu jest rosnąca</b> (najstarsze pierwsze), inaczej niż dawna sekcja
 * historii osobno — kompozytor jest zakotwiczony na dole (decyzja 3), więc naturalny kierunek
 * czytania kończy się tam, gdzie wpisuje się odpowiedź.</p>
 */
@Component({
  selector: 'erp-task-management-issue-activity',
  standalone: true,
  imports: [ErpActivityStreamComponent, ErpButtonComponent, ErpRichTextComponent, ErpUserPickerComponent],
  template: `
    <erp-activity-stream
      [config]="this.streamConfig()"
      (reply)="this.startReply($event)"
      (edit)="this.startEdit($event)"
      (remove)="this.removeAsync($event)"
    />

    <ng-template #composerTpl>
      <div class="flex flex-col gap-2">
        <erp-rich-text [config]="this.composerConfig" [control]="this.composerControl" />
        <div class="flex items-center gap-2">
          <erp-button [config]="this.submitButton" />
          <erp-button [config]="this.mentionButton('composer')" />
        </div>
        @if (this.mentionTarget() === 'composer') {
          <erp-user-picker [config]="this.mentionPickerConfig" [control]="this.mentionControl" />
        }
      </div>
    </ng-template>

    <ng-template #extraTpl let-entry>
      @if (entry.kind === 'comment') {
        @if (this.replyingTo() === entry.uuid) {
          <div class="ml-6 flex flex-col gap-2">
            <erp-rich-text [config]="this.replyConfig" [control]="this.replyControl" />
            <div class="flex items-center gap-2">
              <erp-button [config]="this.submitReplyButton" />
              <erp-button [config]="this.mentionButton('reply')" />
              <erp-button [config]="this.cancelButton" />
            </div>
            @if (this.mentionTarget() === 'reply') {
              <erp-user-picker [config]="this.mentionPickerConfig" [control]="this.mentionControl" />
            }
          </div>
        } @else if (this.editing() === entry.uuid) {
          <div class="flex flex-col gap-2">
            <erp-rich-text [config]="this.editConfig" [control]="this.editControl" />
            <div class="flex items-center gap-2">
              <erp-button [config]="this.submitEditButton" />
              <erp-button [config]="this.mentionButton('edit')" />
              <erp-button [config]="this.cancelButton" />
            </div>
            @if (this.mentionTarget() === 'edit') {
              <erp-user-picker [config]="this.mentionPickerConfig" [control]="this.mentionControl" />
            }
          </div>
        }
      }
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueActivityComponent {
  private readonly _comments = inject(IssueCommentService);
  private readonly _activity = inject(IssueActivityService);
  private readonly _issues = inject(TaskManagementIssueOrchestrator);
  private readonly _attachments = inject(IssueAttachmentService);
  private readonly _content = inject(IssueAttachmentContentService);
  private readonly _confirm = inject(ErpConfirmDialogService);
  private readonly _auth = inject(ErpAuthService);
  private readonly _transloco = inject(TranslocoService);
  private readonly _translationsReady = injectTranslationsReadySignal();
  private readonly _userDirectory = inject(ERP_USER_DIRECTORY, { optional: true });

  public readonly issueUuid = input.required<string | null>();

  public readonly canWrite = input<boolean>(false);

  private readonly _composerTpl = viewChild<TemplateRef<void>>('composerTpl');
  private readonly _extraTpl = viewChild<TemplateRef<{ $implicit: ErpActivityStreamEntry }>>('extraTpl');

  protected readonly composerControl = new FormControl<string>('');
  protected readonly replyControl = new FormControl<string>('');
  protected readonly editControl = new FormControl<string>('');

  protected readonly replyingTo = signal<string | null>(null);
  protected readonly editing = signal<string | null>(null);

  /**
   * Wzmianki `@` (`ISS-009`) — zamiast wtyczki autouzupełniania wpisanej w `tiptap` (edytor jest
   * współdzielony w `shared/ui` i nie ma po co znać `ERP_USER_DIRECTORY`), przycisk „@” otwiera
   * picker katalogu obok aktywnego kompozytora, a wybór dopisuje na koniec treści span w formacie
   * kontraktu z `CommentMentionParser` (`data-mention-user-uuid`). Jeden `FormControl`
   * przełącza cel (`composer`/`reply`/`edit`) sygnałem, żeby nie trzymać trzech pickerów naraz.
   */
  protected readonly mentionTarget = signal<'composer' | 'reply' | 'edit' | null>(null);

  protected readonly mentionControl = new FormControl<string | null>(null);

  protected readonly mentionPickerConfig = { placeholder: ISSUE_KEYS.detail.comments.mentionPlaceholder };

  /** Rezolucje HTML-a komentarzy (adres kanoniczny załącznika → `blob:`) — jedna mapa `uuid`
   * komentarza → treść gotowa do wyświetlenia, wypełniana asynchronicznie. */
  private readonly _resolvedBodies = signal<ReadonlyMap<string, string>>(new Map());

  private readonly _commentUploadPort = createIssueRichTextUploadPort(
    this._attachments,
    this._content,
    () => this.issueUuid(),
    () => this.composerControl,
  );

  protected readonly composerConfig: ErpRichTextConfig = ErpRichTextBuilder.create((b) =>
    b
      .setToolset('full')
      .setMinHeight(120)
      .setPlaceholder(ISSUE_KEYS.detail.comments.placeholder)
      .setUploadImage(this._commentUploadPort),
  );

  protected readonly replyConfig: ErpRichTextConfig = ErpRichTextBuilder.create((b) =>
    b
      .setToolset('full')
      .setMinHeight(100)
      .setPlaceholder(ISSUE_KEYS.detail.comments.replyPlaceholder)
      .setUploadImage(this._commentUploadPort),
  );

  protected readonly editConfig: ErpRichTextConfig = ErpRichTextBuilder.create((b) =>
    b
      .setToolset('full')
      .setMinHeight(100)
      .setPlaceholder(ISSUE_KEYS.detail.comments.placeholder)
      .setUploadImage(this._commentUploadPort),
  );

  protected readonly submitButton: ErpButtonConfig = {
    label: ISSUE_KEYS.detail.comments.submit,
    appearance: 'primary',
    size: 's',
    fn: (): Promise<void> => this._submit(this.composerControl, null),
  };

  protected readonly submitReplyButton: ErpButtonConfig = {
    label: ISSUE_KEYS.detail.comments.submit,
    appearance: 'primary',
    size: 's',
    fn: (): Promise<void> => this._submit(this.replyControl, this.replyingTo()),
  };

  protected readonly submitEditButton: ErpButtonConfig = {
    label: ISSUE_KEYS.detail.comments.save,
    appearance: 'primary',
    size: 's',
    fn: (): Promise<void> => this._saveEdit(),
  };

  protected readonly cancelButton: ErpButtonConfig = {
    label: ISSUE_KEYS.detail.comments.cancel,
    appearance: 'flat',
    size: 's',
    fn: (): void => {
      this.replyingTo.set(null);
      this.editing.set(null);
    },
  };

  private readonly _comm = computed(() => this._comments.commentsOf(this.issueUuid())());
  private readonly _hist = computed(() => this._activity.entriesOf(this.issueUuid())());

  protected readonly streamConfig = computed(() => {
    this._translationsReady();
    return {
      entries: this._entries(),
      expandedUuid: this.replyingTo() ?? this.editing() ?? undefined,
      canWrite: this.canWrite(),
      composerTemplate: this._composerTpl(),
      entryExtraTemplate: this._extraTpl(),
    };
  });

  public constructor() {
    effect(() => {
      const uuid = this.issueUuid();
      untracked(() => {
        if (uuid) {
          void this._comments.loadAsync(uuid);
          void this._activity.loadAsync(uuid);
        }
      });
    });

    // Rozwiązanie obrazków osadzonych w treści komentarzy (adres kanoniczny → `blob:` z
    // tokenem) — bez tego `<img>` wklejony przez `Ctrl+V` (CMT-006) dostałby 401 po odświeżeniu.
    effect(() => {
      const comments = this._comm();
      untracked(() => void this._resolveBodiesAsync(comments));
    });

    this.mentionControl.valueChanges.subscribe((userUuid) => {
      if (userUuid) {
        void this._insertMentionAsync(userUuid);
      }
    });
  }

  protected mentionButton(target: 'composer' | 'reply' | 'edit'): ErpButtonConfig {
    return {
      label: ISSUE_KEYS.detail.comments.mention,
      appearance: 'flat',
      size: 's',
      iconStart: '@tui.at-sign',
      fn: (): void => {
        this.mentionTarget.set(this.mentionTarget() === target ? null : target);
        this.mentionControl.setValue(null);
      },
    };
  }

  private async _insertMentionAsync(userUuid: string): Promise<void> {
    const target = this.mentionTarget();
    const control = target === 'reply' ? this.replyControl : target === 'edit' ? this.editControl : this.composerControl;

    const user = (await this._userDirectory?.getManyAsync([userUuid]))?.[0];
    const displayName = _escapeHtml(user?.displayName ?? userUuid);

    const mentionHtml = `<span data-mention-user-uuid="${userUuid}">@${displayName}</span>&nbsp;`;
    control.setValue((control.value ?? '') + mentionHtml);

    this.mentionTarget.set(null);
    this.mentionControl.setValue(null);
  }

  private readonly _me = computed(() => this._auth.$currentUser()?.id);

  private _entries(): ErpActivityStreamEntry[] {
    const me = this._me();
    const bodies = this._resolvedBodies();

    const commentEntries: ErpActivityStreamEntry[] = this._comm().map((comment) => ({
      kind: 'comment' as const,
      uuid: comment.uuid,
      actorUuid: comment.authorUuid,
      occurredAt: new Date(comment.createdAt),
      bodyHtml: bodies.get(comment.uuid) ?? comment.body,
      isRemoved: comment.isRemoved,
      editedAt: comment.editedAt ? new Date(comment.editedAt) : undefined,
      isAuthor: !!me && comment.authorUuid === me,
      parentUuid: comment.parentUuid,
    }));

    // TIME-001: wpisy czasu wchodzą do strumienia jako filtr „Czas", nie „Historia" — mimo że
    // backend zapisuje je w tej samej tabeli `issue_activity`, co każdą inną zmianę pola.
    const isTimeEntry = (kind: number): boolean =>
      kind === ISSUE_ACTIVITY_KIND.WorkLogAdded || kind === ISSUE_ACTIVITY_KIND.WorkLogRemoved;

    const historyEntries: ErpActivityStreamEntry[] = this._hist().map((entry) => ({
      kind: isTimeEntry(entry.kind) ? ('time' as const) : ('history' as const),
      uuid: entry.uuid,
      actorUuid: entry.actorUuid,
      occurredAt: new Date(entry.occurredAt),
      ...this._sentenceOf(entry),
    }));

    return [...commentEntries, ...historyEntries].sort(
      (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
    );
  }

  /** Pole nazwy PRZED interpolacją — Transloco nie rozwiązuje kluczy zagnieżdżonych w
   * parametrach (`docs/frontend/task-management-pages.md` §2.3). */
  private _sentenceOf(entry: IssueActivityDto): { sentenceKey: string; params?: Record<string, string> } {
    const keys = ISSUE_KEYS.detail.history;

    switch (entry.kind) {
      case ISSUE_ACTIVITY_KIND.Created:
        return { sentenceKey: keys.kind.created, params: { value: entry.newValue ?? '' } };
      case ISSUE_ACTIVITY_KIND.StateChanged:
        return { sentenceKey: keys.kind.stateChanged };
      case ISSUE_ACTIVITY_KIND.CommentAdded:
        return { sentenceKey: keys.kind.commentAdded };
      case ISSUE_ACTIVITY_KIND.CommentRemoved:
        return { sentenceKey: keys.kind.commentRemoved };
      case ISSUE_ACTIVITY_KIND.AttachmentAdded:
        return { sentenceKey: keys.kind.attachmentAdded, params: { value: entry.newValue ?? '' } };
      case ISSUE_ACTIVITY_KIND.WorkLogAdded:
        return { sentenceKey: keys.kind.workLogAdded, params: { value: entry.newValue ?? '' } };
      case ISSUE_ACTIVITY_KIND.WorkLogRemoved:
        return { sentenceKey: keys.kind.workLogRemoved, params: { value: entry.oldValue ?? '' } };
      default: {
        const fieldKey = entry.fieldCode ? (FIELD_KEYS[entry.fieldCode] ?? entry.fieldCode) : '';
        const field = this._transloco.translate(fieldKey);

        if (!entry.oldValue && !entry.newValue) {
          return { sentenceKey: keys.kind.fieldChanged, params: { field } };
        }

        return {
          sentenceKey: keys.kind.fieldChangedWithValues,
          params: { field, from: entry.oldValue ?? '—', to: entry.newValue ?? '—' },
        };
      }
    }
  }

  private async _resolveBodiesAsync(comments: readonly IssueCommentDto[]): Promise<void> {
    const next = new Map(this._resolvedBodies());
    let changed = false;

    for (const comment of comments) {
      if (!comment.isRemoved && !next.has(comment.uuid)) {
        const resolved = await resolveIssueRichTextHtmlAsync(comment.body, this._content);
        next.set(comment.uuid, resolved);
        changed = true;
      }
    }

    if (changed) {
      this._resolvedBodies.set(next);
    }
  }

  protected startReply(uuid: string): void {
    this.replyControl.setValue('');
    this.editing.set(null);
    this.replyingTo.set(uuid);
  }

  protected startEdit(uuid: string): void {
    const comment = this._comm().find((c) => c.uuid === uuid);

    // Ta sama sztuczka co przy edycji opisu: `_resolvedBodies` ma już `blob:` zamiast adresu
    // kanonicznego — surowe `comment.body` dałoby w edytorze rozbity obrazek od razu po wejściu
    // w edycję (bare `<img src>` bez tokenu → 401).
    this.editControl.setValue(this._resolvedBodies().get(uuid) ?? comment?.body ?? '');
    this.replyingTo.set(null);
    this.editing.set(uuid);
  }

  /**
   * Usunięcie jest miękkie (treść znika, wpis w wątku zostaje), więc nakładka to PODMIANA
   * elementu (`isRemoved: true`), nie usunięcie z listy — dokładnie ten sam kształt, jaki wraca
   * potem z serwera.
   */
  protected async removeAsync(uuid: string): Promise<void> {
    const issueUuid = this.issueUuid();
    if (!issueUuid) {
      return;
    }

    const confirmed = await this._confirm.confirmAsync({
      title: ISSUE_KEYS.detail.comments.removeTitle,
      message: ISSUE_KEYS.detail.comments.removeConfirm,
      confirmLabel: ISSUE_KEYS.detail.comments.remove,
      appearance: 'destructive',
    });

    if (!confirmed) {
      return;
    }

    await this._comments.runOptimisticCommentAsync(
      issueUuid,
      replaceOptimisticItem<IssueCommentDto>(uuid, (comment) => ({ ...comment, isRemoved: true, body: '' })),
      () => this._issues.removeCommentAsync({ uuid }),
      { failureMessage: ISSUE_KEYS.detail.comments.removeFailed },
    );
  }

  /**
   * Nakładka optymistyczna (`docs/frontend/optimistic-updates.md`) zastępuje dotychczasowe
   * `erpAwaitJobAsync` + wymuszony refetch: komentarz pojawia się na liście NATYCHMIAST po
   * Enter, pod tym samym uuidem, którym serwer w końcu odpowie (`addCommentAsync` respektuje
   * `command.uuid`, gdy jest podany) — dzięki temu echo `taskmgmt.issue_comment` nie dubluje
   * wpisu. Cofnięcie (4xx, porażka zadania, wyjątek domenowy) oddaje treść z powrotem do
   * edytora i pokazuje toast — obiema ścieżkami zajmuje się `ErpOptimisticRollbackBridge`.
   */
  private async _submit(control: FormControl<string | null>, parentUuid: string | null): Promise<void> {
    const issueUuid = this.issueUuid();
    const raw = control.value?.trim();

    if (!issueUuid || !raw) {
      return;
    }

    const body = canonicalizeIssueRichTextHtml(raw, this._content);
    const uuid = crypto.randomUUID();

    const optimisticComment: IssueCommentDto = {
      uuid,
      issueUuid,
      parentUuid: parentUuid ?? undefined,
      body,
      authorUuid: this._me() ?? '',
      createdAt: new Date(),
      editedAt: undefined,
      isRemoved: false,
    };

    control.setValue('');
    this.replyingTo.set(null);

    await this._comments.runOptimisticCommentAsync(
      issueUuid,
      insertOptimisticItem(optimisticComment),
      () => this._issues.addCommentAsync({ issueUuid, parentUuid: parentUuid ?? undefined, uuid, body }),
      {
        onRollback: () => control.setValue(raw),
        failureMessage: ISSUE_KEYS.detail.comments.failed,
      },
    );
  }

  private async _saveEdit(): Promise<void> {
    const uuid = this.editing();
    const raw = this.editControl.value?.trim();
    const issueUuid = this.issueUuid();

    if (!uuid || !raw || !issueUuid) {
      return;
    }

    const body = canonicalizeIssueRichTextHtml(raw, this._content);
    this.editing.set(null);

    await this._comments.runOptimisticCommentAsync(
      issueUuid,
      replaceOptimisticItem<IssueCommentDto>(uuid, (comment) => ({ ...comment, body, editedAt: new Date() })),
      () => this._issues.setCommentBodyAsync({ uuid, body }),
      {
        onRollback: () => {
          this.editControl.setValue(raw);
          this.editing.set(uuid);
        },
        failureMessage: ISSUE_KEYS.detail.comments.failed,
      },
    );
  }
}

function _escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Nazwy pól — kod pola jest techniczny (`due_at`), klucz rejestru nie. */
const FIELD_KEYS: Record<string, string> = {
  title: ISSUE_KEYS.detail.history.fields.title,
  description: ISSUE_KEYS.detail.history.fields.description,
  priority: ISSUE_KEYS.detail.history.fields.priority,
  assignee: ISSUE_KEYS.detail.history.fields.assignee,
  due_at: ISSUE_KEYS.detail.history.fields.dueAt,
  state: ISSUE_KEYS.detail.history.fields.state,
};
