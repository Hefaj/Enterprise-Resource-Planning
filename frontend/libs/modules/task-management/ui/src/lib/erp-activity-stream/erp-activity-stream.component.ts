import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import {
  ErpButtonComponent,
  ErpButtonConfig,
  ErpToggleGroupConfig,
  ErpToggleGroupComponent,
  ErpTranslatePipe,
  ErpUserAvatarComponent,
  ErpUserNameComponent,
  unwrapSignal,
} from '@erp/shared/ui';

import { ErpActivityStreamConfig, ErpActivityStreamEntry, ErpActivityStreamFilter } from './erp-activity-stream.types';
import { TASKMANAGEMENT_KEYS } from '../translation';

/**
 * Strumień aktywności — komentarze i historia w jednej, chronologicznej liście z filtrem
 * `Wszystko / Komentarze / Historia / Czas` (`docs/modules/task-management/screens.md` §9.1,
 * decyzja 2). Zastępuje dwie osobne sekcje (`erp-task-management-issue-comments`,
 * `…-issue-history`), które przed fazą 4 zmuszały do skakania między nimi, żeby odtworzyć
 * kolejność zdarzeń.
 *
 * <p>Kompozytor jest <b>zakotwiczony na dole</b> (decyzja 3) — `feature` dostarcza go jako
 * `composerTemplate`, bo zna `erp-rich-text` i formularz, których ten atom nie ma prawa znać.</p>
 */
@Component({
  selector: 'erp-activity-stream',
  standalone: true,
  imports: [
    DatePipe,
    NgTemplateOutlet,
    ErpButtonComponent,
    ErpToggleGroupComponent,
    ErpTranslatePipe,
    ErpUserAvatarComponent,
    ErpUserNameComponent,
    ReactiveFormsModule,
  ],
  template: `
    <div class="erp-activity-stream">
      <div class="erp-activity-stream__header">
        <span class="erp-activity-stream__title">{{ TASKMANAGEMENT_KEYS.activityStream.title | erpTranslate }}</span>
        <erp-toggle-group [config]="this.filterConfig" [control]="this.filterControl" />
      </div>

      <div class="erp-activity-stream__list">
        @if (this.visibleEntries().length === 0) {
          <span class="erp-activity-stream__empty">
            {{ TASKMANAGEMENT_KEYS.activityStream.empty | erpTranslate }}
          </span>
        }

        @for (entry of this.visibleEntries(); track entry.uuid) {
          <article class="erp-activity-stream__entry">
            <erp-user-avatar class="erp-activity-stream__avatar" [uuid]="entry.actorUuid" size="s" />

            <div class="erp-activity-stream__content">
              <div class="erp-activity-stream__meta">
                @if (entry.isAutomated) {
                  <span class="erp-activity-stream__automated">
                    {{ TASKMANAGEMENT_KEYS.activityStream.automated | erpTranslate }}
                  </span>
                } @else {
                  <erp-user-name class="erp-activity-stream__actor" [uuid]="entry.actorUuid" />
                }
                <span class="erp-activity-stream__date">{{ entry.occurredAt | date: 'short' }}</span>
              </div>

              @if (entry.kind === 'comment') {
                @if (entry.isRemoved) {
                  <p class="erp-activity-stream__removed">
                    {{ TASKMANAGEMENT_KEYS.activityStream.commentRemoved | erpTranslate }}
                  </p>
                } @else {
                  <div class="erp-activity-stream__body" [innerHTML]="entry.bodyHtml"></div>

                  @if (entry.editedAt) {
                    <span class="erp-activity-stream__hint">
                      {{ TASKMANAGEMENT_KEYS.activityStream.edited | erpTranslate }}
                    </span>
                  }

                  @if (this.canWrite()) {
                    <div class="erp-activity-stream__actions">
                      <erp-button [config]="this.replyButton(entry.uuid)" />
                      @if (entry.isAuthor) {
                        <erp-button [config]="this.editButton(entry.uuid)" />
                        <erp-button [config]="this.removeButton(entry.uuid)" />
                      }
                    </div>
                  }
                }
              } @else {
                <span class="erp-activity-stream__sentence">
                  {{ entry.sentenceKey | erpTranslate: entry.params }}
                </span>
              }

              @if (this.expandedUuid() === entry.uuid && this.entryExtraTemplate()) {
                <div class="erp-activity-stream__extra">
                  <ng-container
                    [ngTemplateOutlet]="this.entryExtraTemplate()!"
                    [ngTemplateOutletContext]="{ $implicit: entry }"
                  />
                </div>
              }
            </div>
          </article>
        }
      </div>

      @if (this.canWrite() && this.composerTemplate()) {
        <div class="erp-activity-stream__composer">
          <ng-container [ngTemplateOutlet]="this.composerTemplate()!" />
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .erp-activity-stream {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .erp-activity-stream__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      }

      .erp-activity-stream__title {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--tui-text-secondary);
      }

      .erp-activity-stream__list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .erp-activity-stream__entry {
        display: flex;
        align-items: flex-start;
        gap: 0.625rem;
        border-bottom: 1px solid var(--tui-border-normal);
        padding-bottom: 0.75rem;
      }

      .erp-activity-stream__entry:last-child {
        border-bottom: none;
      }

      .erp-activity-stream__avatar {
        margin-top: 0.125rem;
      }

      .erp-activity-stream__content {
        display: flex;
        flex: 1;
        min-width: 0;
        flex-direction: column;
        gap: 0.375rem;
      }

      .erp-activity-stream__meta {
        display: flex;
        align-items: baseline;
        gap: 0.5rem;
        font-size: 0.75rem;
        color: var(--tui-text-secondary);
      }

      .erp-activity-stream__sentence {
        font-size: 0.875rem;
      }

      .erp-activity-stream__automated {
        font-weight: 600;
        color: var(--tui-text-tertiary);
      }

      .erp-activity-stream__removed {
        margin: 0;
        font-style: italic;
        color: var(--tui-text-secondary);
      }

      .erp-activity-stream__actions {
        display: flex;
        gap: 0.5rem;
      }

      .erp-activity-stream__hint {
        font-size: 0.75rem;
        color: var(--tui-text-tertiary);
      }

      .erp-activity-stream__empty {
        font-size: 0.875rem;
        color: var(--tui-text-secondary);
      }

      .erp-activity-stream__composer {
        /* Kompozytor pozostaje w zasięgu podczas czytania długiej historii. Tło przejmuje
           aktualny token Taiga, więc nie odsłania przewijanych wpisów pod polem. */
        position: sticky;
        bottom: 0;
        z-index: 1;
        border-top: 1px solid var(--tui-border-normal);
        background: var(--tui-background-base);
        padding-top: 0.75rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpActivityStreamComponent {
  protected readonly TASKMANAGEMENT_KEYS = TASKMANAGEMENT_KEYS;

  public readonly config = input.required<ErpActivityStreamConfig>();

  public readonly reply = output<string>();
  public readonly edit = output<string>();
  public readonly remove = output<string>();

  protected readonly entries = computed(() => unwrapSignal(this.config().entries) ?? []);
  protected readonly expandedUuid = computed(() => unwrapSignal(this.config().expandedUuid));
  protected readonly canWrite = computed(() => unwrapSignal(this.config().canWrite) ?? false);
  protected readonly composerTemplate = computed(() => this.config().composerTemplate);
  protected readonly entryExtraTemplate = computed(() => this.config().entryExtraTemplate);

  // Wielokrotny wybór, bez osobnej opcji „Wszystko" — brak zaznaczenia znaczy „bez filtra"
  // (`visibleEntries` poniżej), więc dodatkowy przycisk pokazywałby dokładnie ten sam stan.
  protected readonly filterControl = new FormControl<ErpActivityStreamFilter[]>([]);
  private readonly _filters = signal<readonly ErpActivityStreamFilter[]>([]);

  private readonly _entryKindByFilter: Record<ErpActivityStreamFilter, ErpActivityStreamEntry['kind']> = {
    comments: 'comment',
    history: 'history',
    time: 'time',
  };

  // Same jako ikony, bez tekstu — trzy pełne etykiety obok siebie nie mieściły się w szerokości
  // panelu (`erp-toggle-group__title` ucinał "Komentarze" w połowie); tooltip niesie etykietę dalej.
  protected readonly filterConfig: ErpToggleGroupConfig = {
    mode: 'multi',
    size: 's',
    items: [
      { value: 'comments', tooltip: TASKMANAGEMENT_KEYS.activityStream.filters.comments, iconStart: '@tui.message-square' },
      { value: 'history', tooltip: TASKMANAGEMENT_KEYS.activityStream.filters.history, iconStart: '@tui.scroll-text' },
      { value: 'time', tooltip: TASKMANAGEMENT_KEYS.activityStream.filters.time, iconStart: '@tui.clock' },
    ],
  };

  protected readonly visibleEntries = computed<readonly ErpActivityStreamEntry[]>(() => {
    const filters = this._filters();
    const entries = this.entries();

    if (filters.length === 0) {
      return entries;
    }

    const kinds = new Set(filters.map((filter) => this._entryKindByFilter[filter]));
    return entries.filter((entry) => kinds.has(entry.kind));
  });

  public constructor() {
    this.filterControl.valueChanges.subscribe((value) => this._filters.set(value ?? []));
  }

  protected replyButton(uuid: string): ErpButtonConfig {
    return {
      label: TASKMANAGEMENT_KEYS.activityStream.reply,
      appearance: 'flat',
      size: 'xs',
      iconStart: '@tui.reply',
      fn: (): void => this.reply.emit(uuid),
    };
  }

  protected editButton(uuid: string): ErpButtonConfig {
    return {
      label: TASKMANAGEMENT_KEYS.activityStream.edit,
      appearance: 'flat',
      size: 'xs',
      iconStart: '@tui.pencil',
      fn: (): void => this.edit.emit(uuid),
    };
  }

  protected removeButton(uuid: string): ErpButtonConfig {
    return {
      label: TASKMANAGEMENT_KEYS.activityStream.remove,
      appearance: 'flat',
      size: 'xs',
      iconStart: '@tui.trash',
      fn: (): void => this.remove.emit(uuid),
    };
  }
}
