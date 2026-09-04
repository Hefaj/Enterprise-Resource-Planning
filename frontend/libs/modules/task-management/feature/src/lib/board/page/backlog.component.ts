import { CdkDragDrop, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

import { ErpButtonComponent, ErpButtonConfig, ErpEmptyStateComponent, ErpTranslatePipe } from '@erp/shared/ui';
import { SPRINT_STATUS } from '@erp/task-management/util';

import { BacklogListComponent } from '../components/backlog-list.component';
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
  imports: [BacklogListComponent, CdkDropListGroup, ErpButtonComponent, ErpEmptyStateComponent, ErpTranslatePipe],
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
          <erp-backlog-list
            class="flex min-h-0 flex-1"
            [title]="BOARD_KEYS.backlog.backlogColumn.title"
            [emptyLabel]="BOARD_KEYS.backlog.backlogColumn.empty"
            [listId]="BACKLOG_LIST_ID"
            [cards]="this.store.backlogCards()"
            (dropped)="this.onDropped($event)"
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

            <erp-backlog-list
              class="flex min-h-0 flex-1"
              [title]="BOARD_KEYS.backlog.title"
              [emptyLabel]="BOARD_KEYS.backlog.sprintColumn.empty"
              [listId]="currentSprint?.uuid ?? ''"
              [cards]="this.store.sprintCards()"
              (dropped)="this.onDropped($event)"
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

  private _cardUuidAt(listId: string, index: number): string | undefined {
    const cards = listId === BACKLOG_LIST_ID ? this.store.backlogCards() : this.store.sprintCards();
    return cards[index]?.uuid;
  }
}
