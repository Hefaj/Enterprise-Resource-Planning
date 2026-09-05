import { CdkDragDrop, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

import { ErpButtonComponent, ErpButtonConfig, ErpEmptyStateComponent, ErpTranslatePipe } from '@erp/shared/ui';
import { ISSUE_PRIORITY, SPRINT_STATUS } from '@erp/task-management/util';
import { ErpBoardColumnComponent, ErpBoardColumnConfig, ErpIssueCardConfig, TASKMANAGEMENT_KEYS } from '@erp/task-management/ui';
import { BoardCardVM, TaskManagementTagOrchestrator } from '@erp/task-management/data-access';

import { BOARD_KEYS, provideBoardTranslations } from '../translation';
import { BacklogStore } from './backlog.store';

/** Sentinel identyfikujący listę backlogu w zdarzeniu `dropped` — nigdy nie koliduje z uuid
 * sprintu (uuid to zawsze 36 znaków z myślnikami). */
const BACKLOG_LIST_ID = 'backlog';

/**
 * Strona `/task-management/board/:uuid/backlog` — podstrona tablicy scrumowej, nie osobna
 * pozycja w menu (`docs/modules/task-management/screens.md` §2.4).
 *
 * <p>Dwie listy obok siebie: backlog i sprint pokazywany obok niego (aktywny, a w jego braku
 * pierwszy planowany). Przeciąganie między nimi zmienia przynależność karty do sprintu
 * (`BoardSetCardSprintCommand`), przeciąganie w obrębie jednej listy — tylko jej pozycję.</p>
 */
@Component({
  selector: 'erp-task-management-backlog',
  standalone: true,
  imports: [ErpBoardColumnComponent, CdkDropListGroup, ErpButtonComponent, ErpEmptyStateComponent, ErpTranslatePipe],
  providers: [BacklogStore, provideBoardTranslations()],
  template: `
    @let board = this.store.board();

    @if (this.store.loading()) {
      <erp-empty-state [config]="{ icon: '@tui.loader', message: BOARD_KEYS.backlog.loading }" />
    } @else if (!board) {
      <erp-empty-state [config]="{ icon: '@tui.search-x', message: BOARD_KEYS.backlog.notFound }" />
    } @else {
      @let currentSprint = this.store.currentSprint();

      <div class="flex h-full min-h-0 w-full flex-col gap-3 p-4">
        <div class="flex items-center justify-between gap-2">
          <span class="text-lg font-medium">{{ board.name | erpTranslate }} — {{ BOARD_KEYS.backlog.title | erpTranslate }}</span>
          <erp-button [config]="this.newSprintButton" />
        </div>

        <div class="flex min-h-0 flex-1 gap-3" cdkDropListGroup>
          <erp-board-column
            class="flex min-h-0 flex-1"
            [config]="this.listConfig(BACKLOG_LIST_ID, BOARD_KEYS.backlog.backlogColumn.title, BOARD_KEYS.backlog.backlogColumn.empty, this.store.backlogCards())"
            (dropped)="this.onDropped($event)"
            (cardMoveRequested)="this.onCardMoveRequested(BACKLOG_LIST_ID, $event)"
          />

          <div class="flex min-h-0 flex-1 flex-col gap-2">
            <div class="flex items-center justify-between gap-2 px-1">
              <span class="text-sm">
                @if (currentSprint) {
                  {{ currentSprint.name }}
                  @if (currentSprint.goal) {
                    <span class="text-[var(--tui-text-tertiary)]"> — {{ currentSprint.goal }}</span>
                  }
                } @else {
                  {{ BOARD_KEYS.backlog.sprintColumn.noSprint | erpTranslate }}
                }
              </span>

              @if (this.sprintActionButton(); as sprintActionButton) {
                <erp-button [config]="sprintActionButton" />
              }
            </div>

            <erp-board-column
              class="flex min-h-0 flex-1"
              [config]="this.listConfig(currentSprint?.uuid ?? '', BOARD_KEYS.backlog.title, BOARD_KEYS.backlog.sprintColumn.empty, this.store.sprintCards())"
              (dropped)="this.onDropped($event)"
              (cardMoveRequested)="this.onCardMoveRequested(currentSprint?.uuid ?? '', $event)"
            />
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        flex: 1;
        height: 100%;
        min-height: 0;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BacklogComponent {
  protected readonly BOARD_KEYS = BOARD_KEYS;
  protected readonly SPRINT_STATUS = SPRINT_STATUS;
  protected readonly BACKLOG_LIST_ID = BACKLOG_LIST_ID;

  protected readonly store = inject(BacklogStore);

  private readonly _route = inject(ActivatedRoute);
  private readonly _tags = inject(TaskManagementTagOrchestrator);

  protected readonly uuid = toSignal(this._route.paramMap.pipe(map((params) => params.get('uuid') ?? '')), {
    initialValue: '',
  });

  protected readonly newSprintButton: ErpButtonConfig = {
    label: BOARD_KEYS.backlog.actions.newSprint,
    appearance: 'secondary',
    fn: (): Promise<void> => this.store.createSprintAsync(),
  };

  /** Rozpoczęcie dla sprintu planowanego, zamknięcie dla aktywnego — `null`, gdy bieżący sprint
   * nie istnieje albo jest już zamknięty (zamknięty sprint jest tylko do odczytu, SPR-003 AC2). */
  protected readonly sprintActionButton = computed<ErpButtonConfig | null>(() => {
    const sprint = this.store.currentSprint();

    if (!sprint) {
      return null;
    }

    if (sprint.status === SPRINT_STATUS.Planned) {
      return {
        label: BOARD_KEYS.backlog.actions.start,
        appearance: 'secondary',
        fn: (): Promise<void> => this.store.startSprintAsync(sprint.uuid),
      };
    }

    if (sprint.status === SPRINT_STATUS.Active) {
      return {
        label: BOARD_KEYS.backlog.actions.close,
        appearance: 'secondary',
        fn: (): Promise<void> => this.store.closeSprintAsync(sprint.uuid),
      };
    }

    return null;
  });

  public constructor() {
    effect(() => {
      const uuid = this.uuid();

      untracked(() => {
        if (uuid) {
          void this.store.openAsync(uuid);
        }
      });
    });

    // Tagi widoczne na projekcie tablicy — te same nazwy co na kartach kanban.
    effect(() => {
      const projectUuid = this.store.board()?.projectUuid;
      untracked(() => void this._tags.searchTagsAsync({ projectUuid }));
    });
  }

  /** Upuszczenie karty w jednej z dwóch list — `container.data` rozstrzyga, czy karta trafia
   * do backlogu (sentinel {@link BACKLOG_LIST_ID}) czy do bieżącego sprintu (jego uuid). */
  protected onDropped(event: CdkDragDrop<string>): void {
    const cardUuid = this._cardUuidAt(event.previousContainer.data, event.previousIndex);

    if (!cardUuid) {
      return;
    }

    if (event.container.data === BACKLOG_LIST_ID) {
      void this.store.dropToBacklogAsync(cardUuid, event.currentIndex);
    } else {
      void this.store.dropToSprintAsync(cardUuid, event.currentIndex);
    }
  }

  protected listConfig(uuid: string, name: string, emptyLabelKey: string, cards: readonly BoardCardVM[]): ErpBoardColumnConfig {
    return {
      uuid,
      name,
      cards: cards.map((card) => ({ uuid: card.uuid, card: this._cardConfig(card) })),
      enabled: true,
      fillAvailableWidth: true,
      countLabelKey: BOARD_KEYS.column.count,
      wipExceededLabelKey: BOARD_KEYS.column.wipExceeded,
      emptyLabelKey,
      cardKeyboardHintKey: BOARD_KEYS.column.cardKeyboardHint,
    };
  }

  /** Klawiaturowa alternatywa przeciągania (WCAG 2.1.1) — tylko dwie listy istnieją, więc
   * kierunek nie ma znaczenia: karta zawsze przenosi się do TEJ DRUGIEJ. */
  protected onCardMoveRequested(fromListId: string, event: { cardUuid: string }): void {
    if (fromListId === BACKLOG_LIST_ID) {
      void this.store.dropToSprintAsync(event.cardUuid, 0);
    } else {
      void this.store.dropToBacklogAsync(event.cardUuid, 0);
    }
  }

  private _cardConfig(card: BoardCardVM): ErpIssueCardConfig {
    return {
      issueKey: card.key,
      title: card.title,
      typeIcon: card.typeIcon,
      typeName: card.typeName,
      priority: card.priority,
      priorityLabelKey: this._priorityKey(card.priority),
      assigneeUuid: card.assigneeUuid,
      assigneeEmptyLabel: BOARD_KEYS.card.unassigned,
      link: ['/task-management/issue', card.key],
      tags: this._tagChips(card.tagUuids),
      estimateMinutes: card.estimateMinutes,
    };
  }

  /** Nazwy tagów rozwiązane z orkiestratora — karta dostaje chipsy gotowe do narysowania. */
  private _tagChips(tagUuids: readonly string[]): { value: string; label: string; translate: false }[] {
    const viewModels = this._tags.getViewModel()();

    return tagUuids
      .map((uuid) => viewModels.get(uuid)?.name)
      .filter((name): name is string => !!name)
      .map((name) => ({ value: name, label: name, translate: false as const }));
  }

  private _priorityKey(priority: number): string {
    switch (priority) {
      case ISSUE_PRIORITY.Critical: return TASKMANAGEMENT_KEYS.priority.critical;
      case ISSUE_PRIORITY.High: return TASKMANAGEMENT_KEYS.priority.high;
      case ISSUE_PRIORITY.Low: return TASKMANAGEMENT_KEYS.priority.low;
      case ISSUE_PRIORITY.Lowest: return TASKMANAGEMENT_KEYS.priority.lowest;
      default: return TASKMANAGEMENT_KEYS.priority.normal;
    }
  }

  private _cardUuidAt(listId: string, index: number): string | undefined {
    const cards = listId === BACKLOG_LIST_ID ? this.store.backlogCards() : this.store.sprintCards();
    return cards[index]?.uuid;
  }
}
