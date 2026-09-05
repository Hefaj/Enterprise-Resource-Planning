import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { ErpTranslatePipe, unwrapSignal } from '@erp/shared/ui';

import { ErpIssueCardComponent, ErpIssueCardConfig } from '../erp-issue-card';
import { ErpBoardColumnConfig } from './erp-board-column.types';

/** Kierunek przeniesienia karty klawiaturą — do sąsiedniej kolumny w kolejności renderowania. */
export interface ErpBoardCardMoveRequest {
  readonly cardUuid: string;
  readonly direction: 'next' | 'prev';
}

/**
 * Prezentacyjna kolumna tablicy. Przeciąganie jest częścią interakcji widoku, ale decyzje
 * domenowe — dostępność kolumny, zmiana stanu i rollback — zostają po stronie feature.
 */
@Component({
  selector: 'erp-board-column',
  standalone: true,
  imports: [CdkDrag, CdkDropList, ErpIssueCardComponent, ErpTranslatePipe],
  template: `
    @let column = this.config();

    <section
      class="flex h-full min-h-0 flex-col rounded-lg bg-[var(--tui-background-neutral-1)]"
      [class.w-72]="!column.fillAvailableWidth"
      [class.shrink-0]="!column.fillAvailableWidth"
      [class.flex-1]="column.fillAvailableWidth"
      [class.opacity-40]="!column.enabled"
      [attr.aria-label]="column.name | erpTranslate"
    >
      <header class="flex items-baseline justify-between gap-2 px-3 py-2">
        <span class="text-sm font-medium">{{ column.name | erpTranslate }}</span>
        <span
          class="text-xs"
          [class.font-medium]="this.wipExceeded()"
          [style.color]="this.wipExceeded() ? 'var(--tui-status-warning)' : 'var(--tui-text-tertiary)'"
        >
          @if (this.wipExceeded()) {
            {{ column.wipExceededLabelKey | erpTranslate: { count: column.cards.length, limit: column.wipLimit } }}
          } @else {
            {{ column.countLabelKey | erpTranslate: { count: column.cards.length } }}
          }
        </span>
      </header>

      <div
        cdkDropList
        class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2"
        [cdkDropListData]="column.uuid"
        [cdkDropListEnterPredicate]="this.acceptDrop"
        (cdkDropListDropped)="this.dropped.emit($event)"
      >
        @for (item of column.cards; track item.uuid) {
          <div
            cdkDrag
            tabindex="0"
            [attr.aria-label]="column.cardKeyboardHintKey | erpTranslate"
            [cdkDragDisabled]="this.isCardDisabled(item.card)"
            (cdkDragStarted)="this.dragStarted.emit(item.uuid)"
            (cdkDragEnded)="this.dragEnded.emit()"
            (keydown.arrowright)="this.onKeyboardMove($event, item.uuid, 'next')"
            (keydown.arrowleft)="this.onKeyboardMove($event, item.uuid, 'prev')"
          >
            <erp-issue-card [config]="item.card" />
          </div>
        } @empty {
          <span class="px-1 py-4 text-xs text-[var(--tui-text-tertiary)]">
            {{ column.emptyLabelKey | erpTranslate }}
          </span>
        }
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpBoardColumnComponent {
  public readonly config = input.required<ErpBoardColumnConfig>();
  public readonly dropped = output<CdkDragDrop<string>>();
  public readonly dragStarted = output<string>();
  public readonly dragEnded = output<void>();
  /** Klawiaturowa alternatywa przeciągania (WCAG 2.1.1) — kolumna nie wie, co jest po sąsiedzku,
   * więc tylko przekazuje intencję dalej do feature, które zna cały układ tablicy. */
  public readonly cardMoveRequested = output<ErpBoardCardMoveRequest>();

  protected readonly wipExceeded = computed(() => {
    const { cards, wipLimit } = this.config();
    return wipLimit !== undefined && cards.length > wipLimit;
  });

  /** CDK pyta w chwili najechania kartą; to gwarantuje natychmiastowy feedback wizualny. */
  protected readonly acceptDrop = (): boolean => this.config().enabled;

  /** Karta z własnym ruchem w toku (nakładka optymistyczna, `disabled` w configu) nie startuje
   * drugiego przeciągnięcia — zapobiega złożeniu dwóch komend pozycji nad tym samym wierszem. */
  protected isCardDisabled(card: ErpIssueCardConfig): boolean {
    return unwrapSignal(card.disabled) ?? false;
  }

  protected onKeyboardMove(event: Event, cardUuid: string, direction: 'next' | 'prev'): void {
    event.preventDefault();
    this.cardMoveRequested.emit({ cardUuid, direction });
  }
}
