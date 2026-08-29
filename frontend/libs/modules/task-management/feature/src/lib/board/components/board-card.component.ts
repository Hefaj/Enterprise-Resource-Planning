import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ErpTranslatePipe } from '@erp/shared/ui';
import { BoardCardVM } from '@erp/task-management/data-access';
import { ISSUE_PRIORITY } from '@erp/task-management/util';
import { TASKMANAGEMENT_KEYS } from '@erp/task-management/ui';

import { BOARD_KEYS } from '../translation';
import { TaskManagementUserNameComponent } from '../../user/task-management-user-name.component';

/**
 * Karta na tablicy — komponent prezentacyjny. Nie zna orkiestratora, nie wysyła komend
 * i nie wie, że jest przeciągana: przeciąganie obsługuje kolumna, bo to ona jest listą.
 */
@Component({
  selector: 'erp-board-card',
  standalone: true,
  imports: [ErpTranslatePipe, RouterLink, TaskManagementUserNameComponent],
  template: `
    @let card = this.card();

    <div class="flex flex-col gap-2 rounded-md border border-[var(--tui-border-normal)] bg-[var(--tui-background-base)] p-3">
      <div class="flex items-center justify-between gap-2">
        <a
          class="font-mono text-xs text-[var(--tui-text-secondary)] hover:underline"
          [routerLink]="['/task-management/issue', card.key]"
          >{{ card.key }}</a
        >
        <span
          class="text-xs"
          [class]="priorityClass()"
          >{{ priorityKey() | erpTranslate }}</span
        >
      </div>

      <span class="text-sm leading-snug">{{ card.title }}</span>

      <erp-task-management-user-name
        [uuid]="card.assigneeUuid"
        [empty]="BOARD_KEYS.card.unassigned | erpTranslate"
      />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardCardComponent {
  protected readonly BOARD_KEYS = BOARD_KEYS;

  public readonly card = input.required<BoardCardVM>();

  protected readonly priorityKey = computed(() => {
    switch (this.card().priority) {
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
  });

  protected readonly priorityClass = computed(() => {
    switch (this.card().priority) {
      case ISSUE_PRIORITY.Critical:
      case ISSUE_PRIORITY.High:
        return 'text-[var(--tui-status-negative)]';
      case ISSUE_PRIORITY.Low:
      case ISSUE_PRIORITY.Lowest:
        return 'text-[var(--tui-text-tertiary)]';
      default:
        return 'text-[var(--tui-text-secondary)]';
    }
  });
}
