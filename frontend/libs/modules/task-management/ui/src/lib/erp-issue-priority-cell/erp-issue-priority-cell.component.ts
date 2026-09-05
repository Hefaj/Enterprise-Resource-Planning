import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ErpTranslatePipe } from '@erp/shared/ui';
import { ISSUE_PRIORITY } from '@erp/task-management/util';

import { TASKMANAGEMENT_KEYS } from '../translation';

/** Wiersz musi nieść tylko `priority` — komórka nie zna reszty kształtu `IssueVM`. */
export interface ErpIssuePriorityCellRow {
  readonly priority?: number;
}

/**
 * Znacznik priorytetu w komórce tabeli — kolorowa kropka + etykieta, nie sam tekst
 * (`docs/modules/task-management/screens.md` §9.2: „priorytet jako kolorowy znacznik przy
 * wierszu, nie tekst"). Ta sama kolorystyka co `erp-issue-card` na tablicy, żeby priorytet
 * wyglądał tak samo w liście i na kafelku.
 */
@Component({
  selector: 'erp-issue-priority-cell',
  standalone: true,
  imports: [ErpTranslatePipe],
  template: `
    <span class="flex items-center gap-1.5">
      <span class="h-2 w-2 shrink-0 rounded-full" [class]="dotClass()" aria-hidden="true"></span>
      <span>{{ labelKey() | erpTranslate }}</span>
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpIssuePriorityCellComponent {
  public readonly row = input.required<ErpIssuePriorityCellRow>();

  protected readonly labelKey = computed(() => {
    switch (this.row().priority) {
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

  protected readonly dotClass = computed(() => {
    switch (this.row().priority) {
      case ISSUE_PRIORITY.Critical:
      case ISSUE_PRIORITY.High:
        return 'bg-[var(--tui-status-negative)]';
      case ISSUE_PRIORITY.Low:
      case ISSUE_PRIORITY.Lowest:
        return 'bg-[var(--tui-text-tertiary)]';
      default:
        return 'bg-[var(--tui-status-warning)]';
    }
  });
}
