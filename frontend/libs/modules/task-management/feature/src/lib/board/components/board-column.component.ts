import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { ErpTranslatePipe } from '@erp/shared/ui';
import { BoardCardVM } from '@erp/task-management/data-access';
import { ErpIssueCardComponent, ErpIssueCardConfig, TASKMANAGEMENT_KEYS } from '@erp/task-management/ui';
import { ISSUE_PRIORITY } from '@erp/task-management/util';

import { BoardColumnVM } from '../page/board.store';
import { BOARD_KEYS } from '../translation';

/**
 * Kolumna tablicy — lista kart z obsługą przeciągania (`cdkDropList`).
 *
 * <p>Kolumna <b>niedostępna dla chwyconej karty jest wygaszona i nie przyjmuje upuszczenia</b>
 * (`[cdkDropListEnterPredicate]`). Dzieje się to w chwili chwycenia karty, a nie po jej
 * upuszczeniu — poznanie zakazu dopiero z błędu jest wrogie użytkownikowi
 * (`docs/frontend/task-management-pages.md` §2.2).</p>
 */
@Component({
  selector: 'erp-board-column',
  standalone: true,
  imports: [ErpIssueCardComponent, CdkDrag, CdkDropList, ErpTranslatePipe],
  template: `
    @let column = this.column();

    <div
      class="flex h-full min-h-0 w-72 shrink-0 flex-col rounded-lg bg-[var(--tui-background-neutral-1)]"
      [class.opacity-40]="!this.enabled()"
    >
      <div class="flex items-baseline justify-between gap-2 px-3 py-2">
        <span class="text-sm font-medium">{{ column.name | erpTranslate }}</span>
        <span
          class="text-xs"
          [class.font-medium]="this.wipExceeded(column)"
          [style.color]="this.wipExceeded(column) ? 'var(--tui-status-warning)' : 'var(--tui-text-tertiary)'"
        >
          @if (this.wipExceeded(column)) {
            {{ BOARD_KEYS.column.wipExceeded | erpTranslate: { count: column.cards.length, limit: column.wipLimit } }}
          } @else {
            {{ BOARD_KEYS.column.count | erpTranslate: { count: column.cards.length } }}
          }
        </span>
      </div>

      <div
        cdkDropList
        class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2"
        [cdkDropListData]="column.uuid"
        [cdkDropListEnterPredicate]="this.acceptDrop"
        (cdkDropListDropped)="this.dropped.emit($event)"
      >
        @for (card of column.cards; track card.uuid) {
          <div cdkDrag (cdkDragStarted)="this.dragStarted.emit(card.uuid)" (cdkDragEnded)="this.dragEnded.emit()">
            <erp-issue-card [config]="this.cardConfig(card)" />
          </div>
        } @empty {
          <span class="px-1 py-4 text-xs text-[var(--tui-text-tertiary)]">
            {{ BOARD_KEYS.empty.column | erpTranslate }}
          </span>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardColumnComponent {
  protected readonly BOARD_KEYS = BOARD_KEYS;

  public readonly column = input.required<BoardColumnVM>();

  /** Czy chwycona karta może tu wylądować — liczone ze schematu przejść projektu. */
  public readonly enabled = input<boolean>(true);

  public readonly dropped = output<CdkDragDrop<string>>();

  public readonly dragStarted = output<string>();

  public readonly dragEnded = output<void>();

  /** Predykat CDK jest zwykłą funkcją, nie sygnałem — czytamy `enabled()` w momencie
   * najechania kursorem, czyli dokładnie wtedy, gdy pytanie jest zadawane. */
  protected readonly acceptDrop = (): boolean => this.enabled();

  /**
   * BRD-007 — sygnał wyłącznie wizualny, nigdy nie blokuje upuszczenia karty.
   *
   * <p><b>`!= null`, nie `!== undefined`</b> — backend serializuje brak limitu jako JSON
   * `null`, nie przez pominięcie klucza. `null !== undefined` jest `true`, więc ścisłe
   * porównanie do `undefined` przepuszczałoby `null` dalej, a `column.cards.length > null`
   * dawałoby `true` dla każdej niepustej kolumny (`null` rzutuje się na `0`) — dokładnie ten
   * sam błąd, co przy estymacie w `IssueTimeComponent` (TIME-002).</p>
   */
  protected wipExceeded(column: BoardColumnVM): boolean {
    return (
      column.wipLimit !== null && column.wipLimit !== undefined && column.cards.length > column.wipLimit
    );
  }

  /**
   * Konfiguracja `erp-issue-card`. `typeIcon`/`typeName` jadą wprost z `BoardCardDto`
   * (kontrakt `getBoardCards` niesie je razem z nagłówkiem karty, `TYP-002/003`).
   */
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
