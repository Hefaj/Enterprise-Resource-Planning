import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { ErpTranslatePipe } from '@erp/shared/ui';
import { BoardCardVM } from '@erp/task-management/data-access';
import { ErpIssueCardComponent, ErpIssueCardConfig, TASKMANAGEMENT_KEYS } from '@erp/task-management/ui';
import { ISSUE_PRIORITY } from '@erp/task-management/util';

import { BOARD_KEYS } from '../translation';

/**
 * Jedna lista backlogu — backlog albo sprint, ta sama karta co na tablicy kanbanowej
 * (`erp-issue-card`). Kolejność między dwiema instancjami tego komponentu łączy wspólny
 * `cdkDropListGroup` na stronie ({@link BacklogComponent}), nie połączenie tutaj — dwie listy
 * to najprostszy przypadek, który nie wymaga jawnego `cdkDropListConnectedTo`.
 */
@Component({
  selector: 'erp-backlog-list',
  standalone: true,
  imports: [ErpIssueCardComponent, CdkDrag, CdkDropList, ErpTranslatePipe],
  template: `
    <div class="flex h-full min-h-0 flex-1 flex-col rounded-lg bg-[var(--tui-background-neutral-1)]">
      <div class="flex items-baseline justify-between gap-2 px-3 py-2">
        <span class="text-sm font-medium">{{ this.title() | erpTranslate }}</span>
        <span class="text-xs text-[var(--tui-text-tertiary)]">
          {{ BOARD_KEYS.column.count | erpTranslate: { count: this.cards().length } }}
        </span>
      </div>

      <div
        cdkDropList
        class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2"
        [cdkDropListData]="this.listId()"
        (cdkDropListDropped)="this.dropped.emit($event)"
      >
        @for (card of this.cards(); track card.uuid) {
          <div cdkDrag (cdkDragStarted)="this.dragStarted.emit(card.uuid)" (cdkDragEnded)="this.dragEnded.emit()">
            <erp-issue-card [config]="this.cardConfig(card)" />
          </div>
        } @empty {
          <span class="px-1 py-4 text-xs text-[var(--tui-text-tertiary)]">
            {{ this.emptyLabel() | erpTranslate }}
          </span>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BacklogListComponent {
  protected readonly BOARD_KEYS = BOARD_KEYS;

  /** Nagłówek listy — klucz tłumaczenia. */
  public readonly title = input.required<string>();

  /** Komunikat pustej listy — klucz tłumaczenia. */
  public readonly emptyLabel = input.required<string>();

  /** Identyfikator listy przekazywany w zdarzeniu `dropped` jako `container.data` —
   * `'backlog'` albo uuid sprintu, rozstrzygane przez {@link BacklogComponent}. */
  public readonly listId = input.required<string>();

  public readonly cards = input.required<readonly BoardCardVM[]>();

  public readonly dropped = output<CdkDragDrop<string>>();

  public readonly dragStarted = output<string>();

  public readonly dragEnded = output<void>();

  protected cardConfig(card: BoardCardVM): ErpIssueCardConfig {
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
    };
  }

  private _priorityKey(priority: number): string {
    switch (priority) {
      case ISSUE_PRIORITY.Critical:
        return TASKMANAGEMENT_KEYS.priority.critical;
      case ISSUE_PRIORITY.High:
        return TASKMANAGEMENT_KEYS.priority.high;
      case ISSUE_PRIORITY.Low:
        return TASKMANAGEMENT_KEYS.priority.low;
      case ISSUE_PRIORITY.Lowest:
        return TASKMANAGEMENT_KEYS.priority.lowest;
      default:
        return TASKMANAGEMENT_KEYS.priority.normal;
    }
  }
}
