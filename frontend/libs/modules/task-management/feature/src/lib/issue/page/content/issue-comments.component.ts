import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { TuiEditorTool } from '@taiga-ui/editor';

import { ErpButtonComponent, ErpButtonConfig, ErpConfirmDialogService, ErpInputPickerComponent, ErpRichTextBuilder, ErpRichTextComponent, ErpRichTextConfig, ErpToastService, ErpTranslatePipe, erpRichTextToolset } from '@erp/shared/ui';
import { ErpAuthService } from '@erp/shared/auth';
import { ERP_USER_DIRECTORY } from '@erp/shared/util';
import { IssueCommentDto, IssueCommentService, TaskManagementIssueOrchestrator } from '@erp/task-management/data-access';

import { ISSUE_KEYS } from '../../translation';
import { TaskManagementUserNameComponent } from '../../../user/task-management-user-name.component';
import { taskManagementUserPickerConfig } from '../../../user/task-management-user-picker';
import { IssueRichTextImagesService } from './issue-rich-text-images.service';

/** Wątek złożony z komentarza głównego i jego odpowiedzi — poziom jest dokładnie jeden. */
interface IssueCommentThread {
  readonly root: IssueCommentDto;
  readonly replies: readonly IssueCommentDto[];
}

/**
 * Dyskusja pod zgłoszeniem.
 *
 * <p><b>Wątki są jednopoziomowe</b> i to jest reguła domeny, nie uproszczenie widoku
 * (`docs/backend/task-management.md` §11): odpowiedź wskazuje komentarz główny i nic głębiej.
 * Dlatego drzewo składa się tu jednym przebiegiem po płaskiej liście, bez rekurencji.</p>
 *
 * <p><b>Po zapisie nic nie dopisujemy do listy ręcznie.</b> Komenda idzie zadaniem, a wątek
 * wraca zdarzeniem na kanale <c>taskmgmt.issue_comment</c> — tą samą drogą, którą przychodzi
 * cudza wypowiedź. Optymistyczne wstawienie własnego komentarza dałoby przez chwilę dwa: ten
 * dorysowany i ten z serwera.</p>
 */
@Component({
  selector: 'erp-task-management-issue-comments',
  standalone: true,
  imports: [DatePipe, NgTemplateOutlet, ErpButtonComponent, ErpInputPickerComponent, ErpRichTextComponent, ErpTranslatePipe, TaskManagementUserNameComponent],
  template: `
    <section class="flex flex-col gap-3">
      <h2 class="m-0 text-sm font-semibold uppercase text-[var(--tui-text-secondary)]">
        {{ ISSUE_KEYS.detail.comments.label | erpTranslate }}
      </h2>

      @if (threads().length === 0) {
        <p class="m-0 text-sm text-[var(--tui-text-secondary)]">
          {{ ISSUE_KEYS.detail.comments.empty | erpTranslate }}
        </p>
      }

      @for (thread of threads(); track thread.root.uuid) {
        <article class="flex flex-col gap-2 rounded border border-[var(--tui-border-normal)] p-3">
          <ng-container *ngTemplateOutlet="commentTpl; context: { $implicit: thread.root }" />

          @for (reply of thread.replies; track reply.uuid) {
            <div class="ml-6 border-l-2 border-[var(--tui-border-normal)] pl-3">
              <ng-container *ngTemplateOutlet="commentTpl; context: { $implicit: reply }" />
            </div>
          }

          @if (canWrite() && !thread.root.isRemoved) {
            @if (replyingTo() === thread.root.uuid) {
              <div class="ml-6 flex flex-col gap-2">
                <erp-rich-text
                  [config]="replyEditorConfig"
                  [control]="replyControl"
                />
                <div class="flex gap-2">
                  <erp-button [config]="submitReplyButton" />
                  <erp-button [config]="cancelReplyButton" />
                </div>
              </div>
            } @else {
              <div>
                <erp-button [config]="replyButton(thread.root.uuid)" />
              </div>
            }
          }
        </article>
      }

      @if (canWrite()) {
        <div class="flex flex-col gap-2">
          <erp-rich-text
            [config]="composerConfig"
            [control]="composerControl"
          />
          <div class="flex items-end gap-2">
            <erp-button [config]="submitButton" />
            <erp-input-picker
              class="w-64"
              [config]="mentionPickerConfig"
              [control]="mentionControl"
            />
            <erp-button [config]="insertMentionButton" />
          </div>
        </div>
      }
    </section>

    <ng-template
      #commentTpl
      let-comment
    >
      <div class="flex flex-col gap-1">
        <div class="flex flex-wrap items-center gap-2 text-xs text-[var(--tui-text-secondary)]">
          <erp-task-management-user-name
            class="font-medium"
            [uuid]="comment.authorUuid"
          />
          <span>{{ comment.createdAt | date: 'short' }}</span>
          @if (comment.editedAt) {
            <span>({{ ISSUE_KEYS.detail.comments.edited | erpTranslate }})</span>
          }
        </div>

        @if (comment.isRemoved) {
          <p class="m-0 text-sm italic text-[var(--tui-text-secondary)]">
            {{ ISSUE_KEYS.detail.comments.removed | erpTranslate }}
          </p>
        } @else if (editing() === comment.uuid) {
          <erp-rich-text
            [config]="editEditorConfig"
            [control]="editControl"
          />
          <div class="flex gap-2">
            <erp-button [config]="submitEditButton" />
            <erp-button [config]="cancelEditButton" />
          </div>
        } @else {
          <erp-rich-text [config]="bodyConfig(comment.body)" />

          @if (isAuthor(comment) && !editing()) {
            <div class="flex gap-2">
              <erp-button [config]="editButton(comment)" />
              <erp-button [config]="removeButton(comment)" />
            </div>
          }
        }
      </div>
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueCommentsComponent {
  protected readonly ISSUE_KEYS = ISSUE_KEYS;

  /** Zgłoszenie, którego dyskusję pokazuje sekcja. */
  public readonly issueUuid = input.required<string | null>();

  /** Czy wolno pisać — uprawnienie liczy karta, nie ta sekcja. */
  public readonly canWrite = input<boolean>(false);

  private readonly _comments = inject(IssueCommentService);
  private readonly _orchestrator = inject(TaskManagementIssueOrchestrator);
  private readonly _confirm = inject(ErpConfirmDialogService);
  private readonly _toasts = inject(ErpToastService);
  private readonly _auth = inject(ErpAuthService);
  private readonly _richTextImages = inject(IssueRichTextImagesService);

  protected readonly composerControl = new FormControl<string>('');

  /** Osoba wybrana do wzmiankowania; wstawienie czyści pole, żeby dało się wskazać kolejną. */
  protected readonly mentionControl = new FormControl<string | null>(null);
  protected readonly replyControl = new FormControl<string>('');
  protected readonly editControl = new FormControl<string>('');

  /** Uuid komentarza głównego, pod którym otwarto pole odpowiedzi. */
  protected readonly replyingTo = signal<string | null>(null);

  /** Uuid edytowanego komentarza. */
  protected readonly editing = signal<string | null>(null);

  private readonly _list = computed(() => this._comments.commentsOf(this.issueUuid())());

  protected readonly threads = computed<IssueCommentThread[]>(() => {
    const list = this._list();
    const replies = new Map<string, IssueCommentDto[]>();

    for (const comment of list) {
      if (comment.parentUuid) {
        const bucket = replies.get(comment.parentUuid);
        if (bucket) {
          bucket.push(comment);
        } else {
          replies.set(comment.parentUuid, [comment]);
        }
      }
    }

    return list.filter((comment) => !comment.parentUuid).map((root) => ({ root, replies: replies.get(root.uuid) ?? [] }));
  });

  protected readonly composerConfig: ErpRichTextConfig = ErpRichTextBuilder.create((b) => b.setTools([...erpRichTextToolset('basic'), TuiEditorTool.Img]).setMinHeight(120).setPlaceholder(ISSUE_KEYS.detail.comments.placeholder));

  protected readonly replyEditorConfig: ErpRichTextConfig = ErpRichTextBuilder.create((b) => b.setTools([...erpRichTextToolset('basic'), TuiEditorTool.Img]).setMinHeight(100).setPlaceholder(ISSUE_KEYS.detail.comments.replyPlaceholder));

  protected readonly editEditorConfig: ErpRichTextConfig = ErpRichTextBuilder.create((b) => b.setTools([...erpRichTextToolset('basic'), TuiEditorTool.Img]).setMinHeight(100).setPlaceholder(ISSUE_KEYS.detail.comments.placeholder));

  protected readonly submitButton: ErpButtonConfig = {
    label: ISSUE_KEYS.detail.comments.submit,
    appearance: 'primary',
    size: 's',
    fn: (): Promise<void> => this._submit(this.composerControl, null),
  };

  /**
   * Wzmianka — wybór osoby i wstawienie jej do treści.
   *
   * <p><b>Picker obok edytora, nie podpowiadanie po wpisaniu „@".</b> Autouzupełnianie w środku
   * edytora wymaga własnego rozszerzenia ProseMirror i własnej nawigacji klawiaturą; ten sam
   * skutek — komentarz z <c>data-mention-uuid</c>, po którym backend wylicza odbiorców — daje
   * picker, który już mamy i który korzysta z tego samego katalogu użytkowników.</p>
   */
  private readonly _directory = inject(ERP_USER_DIRECTORY, { optional: true });

  protected readonly mentionPickerConfig = taskManagementUserPickerConfig(this._directory, {
    label: ISSUE_KEYS.detail.comments.mention.label,
  });

  protected readonly insertMentionButton: ErpButtonConfig = {
    label: ISSUE_KEYS.detail.comments.mention.insert,
    appearance: 'flat',
    size: 's',
    fn: (): void => this._insertMention(),
  };

  protected readonly submitReplyButton: ErpButtonConfig = {
    label: ISSUE_KEYS.detail.comments.submit,
    appearance: 'primary',
    size: 's',
    fn: (): Promise<void> => this._submit(this.replyControl, this.replyingTo()),
  };

  protected readonly cancelReplyButton: ErpButtonConfig = {
    label: ISSUE_KEYS.detail.comments.cancel,
    appearance: 'flat',
    size: 's',
    fn: (): void => this.replyingTo.set(null),
  };

  protected readonly submitEditButton: ErpButtonConfig = {
    label: ISSUE_KEYS.detail.comments.save,
    appearance: 'primary',
    size: 's',
    fn: (): Promise<void> => this._saveEdit(),
  };

  protected readonly cancelEditButton: ErpButtonConfig = {
    label: ISSUE_KEYS.detail.comments.cancel,
    appearance: 'flat',
    size: 's',
    fn: (): void => this.editing.set(null),
  };

  public constructor() {
    effect(() => {
      const uuid = this.issueUuid();
      untracked(() => {
        if (uuid) {
          void this._comments.loadAsync(uuid);
        }
      });
    });
  }

  /** Podgląd treści — ten sam edytor w trybie tylko do odczytu, więc formatowanie zgadza się
   * z tym, co widział piszący. */
  protected bodyConfig(body: string): ErpRichTextConfig {
    return ErpRichTextBuilder.create((b) => b.setReadOnly(true).setValue(this._richTextImages.displayHtml(body)));
  }

  /** Czy zalogowany jest autorem — po tym idzie widoczność „edytuj”. Backend i tak odrzuci
   * cudzą edycję (`taskmgmt.comment_not_author`); tutaj chodzi o to, żeby nie pokazywać
   * przycisku, który zawsze skończy się błędem. */
  protected isAuthor(comment: IssueCommentDto): boolean {
    const me = this._auth.$currentUser()?.id;
    return !!me && comment.authorUuid === me;
  }

  protected replyButton(rootUuid: string): ErpButtonConfig {
    return {
      label: ISSUE_KEYS.detail.comments.reply,
      appearance: 'flat',
      size: 'xs',
      iconStart: '@tui.reply',
      fn: (): void => {
        this.replyControl.setValue('');
        this.replyingTo.set(rootUuid);
      },
    };
  }

  protected editButton(comment: IssueCommentDto): ErpButtonConfig {
    return {
      label: ISSUE_KEYS.detail.comments.edit,
      appearance: 'flat',
      size: 'xs',
      iconStart: '@tui.pencil',
      fn: (): void => {
        this.editControl.setValue(comment.body);
        this.editing.set(comment.uuid);
      },
    };
  }

  protected removeButton(comment: IssueCommentDto): ErpButtonConfig {
    return {
      label: ISSUE_KEYS.detail.comments.remove,
      appearance: 'flat',
      size: 'xs',
      iconStart: '@tui.trash',
      fn: (): Promise<void> => this._remove(comment),
    };
  }

  /** Wstawia wzmiankę na koniec treści. `data-mention-uuid` przechodzi przez sanitizer backendu
   * i jest jedynym źródłem, z którego wyliczani są odbiorcy powiadomienia. */
  private _insertMention(): void {
    const uuid = this.mentionControl.value;
    if (!uuid) {
      return;
    }

    const user = this._directory?.getOne(uuid)();
    const label = user?.displayName ?? uuid;
    const current = this.composerControl.value ?? '';

    this.composerControl.setValue(`${current}<p><span data-mention-uuid="${uuid}">@${label}</span> </p>`);
    this.mentionControl.setValue(null);
  }

  private async _submit(control: FormControl<string | null>, parentUuid: string | null): Promise<void> {
    const issueUuid = this.issueUuid();
    // Wstawienie obrazu kończy się po asynchronicznym uploadzie. Normalizacja tuż przed
    // komendą gwarantuje, że zapisany HTML wskazuje na trwały endpoint załącznika, a nie
    // tymczasowy `blob:` z karty przeglądarki.
    const body = this._richTextImages.toControlValue(control.value).trim();

    if (!issueUuid || !body) {
      return;
    }

    try {
      await this._orchestrator.addCommentAsync({
        issueUuid,
        parentUuid: parentUuid ?? undefined,
        body,
      });

      control.setValue('');
      this.replyingTo.set(null);

      // Zadanie kończy się asynchronicznie, a zdarzenie realtime dotyczy komentarza, nie
      // zgłoszenia — jedno wymuszone odświeżenie zamyka lukę, gdyby zdarzenie wyprzedziło zapis.
      await this._comments.loadAsync(issueUuid, true);
    } catch (error) {
      this._reportFailure(error);
    }
  }

  private async _saveEdit(): Promise<void> {
    const uuid = this.editing();
    const body = this._richTextImages.toControlValue(this.editControl.value).trim();
    const issueUuid = this.issueUuid();

    if (!uuid || !body || !issueUuid) {
      return;
    }

    try {
      await this._orchestrator.setCommentBodyAsync({ uuid, body });
      this.editing.set(null);
      await this._comments.loadAsync(issueUuid, true);
    } catch (error) {
      this._reportFailure(error);
    }
  }

  private async _remove(comment: IssueCommentDto): Promise<void> {
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

    try {
      await this._orchestrator.removeCommentAsync({ uuid: comment.uuid });
      await this._comments.loadAsync(issueUuid, true);
    } catch (error) {
      this._reportFailure(error);
    }
  }

  private _reportFailure(error: unknown): void {
    console.error('[IssueCommentsComponent] Nie udało się zapisać komentarza.', error);
    this._toasts.show({ message: ISSUE_KEYS.detail.comments.failed, appearance: 'negative' });
  }
}
