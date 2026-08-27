import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { ErpTranslatePipe } from '@erp/shared/ui';

import { BoardColumnVM } from '../page/board.store';
import { BOARD_KEYS } from '../translation';
import { BoardCardComponent } from './board-card.component';

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
  imports: [BoardCardComponent, CdkDrag, CdkDropList, ErpTranslatePipe],
  template: `
    @let column = this.column();

    <div
      class="flex h-full min-h-0 w-72 shrink-0 flex-col rounded-lg bg-[var(--tui-background-neutral-1)]"
      [class.opacity-40]="!this.enabled()"
    >
      <div class="flex items-baseline justify-between gap-2 px-3 py-2">
        <span class="text-sm font-medium">{{ column.name | erpTranslate }}</span>
        <span class="text-xs text-[var(--tui-text-tertiary)]">
          {{ BOARD_KEYS.column.count | erpTranslate: { count: column.cards.length } }}
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
            <erp-board-card [card]="card" />
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
}
