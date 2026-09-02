import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { ErpEmptyStateComponent, ErpTranslatePipe } from '@erp/shared/ui';
import { BoardDto, TaskManagementBoardOrchestrator } from '@erp/task-management/data-access';

import { BOARD_KEYS, provideBoardTranslations } from '../translation';

/**
 * Strona `/task-management/board` — lista tablic widocznych dla użytkownika (BRD-009 AC1).
 *
 * <p>Przy dokładnie jednej widocznej tablicy przekierowuje wprost na nią (`replaceUrl`, żeby
 * „wstecz” nie wracało na listę jednoelementową). Backend już dziś zwraca tylko tablice
 * widoczne — widoczność dziedziczy po projekcie — więc ta strona nie dokłada żadnego nowego
 * zapytania poza `searchBoard`.</p>
 */
@Component({
  selector: 'erp-task-management-board-list',
  standalone: true,
  imports: [ErpEmptyStateComponent, ErpTranslatePipe, RouterLink],
  providers: [provideBoardTranslations()],
  template: `
    @if (this.loading()) {
      <erp-empty-state [config]="{ icon: '@tui.loader', message: BOARD_KEYS.list.loading }" />
    } @else if (this.boards().length === 0) {
      <erp-empty-state [config]="{ icon: '@tui.columns-3', message: BOARD_KEYS.list.empty }" />
    } @else {
      <div class="flex h-full min-h-0 w-full flex-col gap-3 p-4">
        <span class="text-lg font-medium">{{ BOARD_KEYS.list.title | erpTranslate }}</span>

        <ul class="flex flex-col gap-1">
          @for (board of this.boards(); track board.uuid) {
            <li>
              <a
                class="block rounded px-3 py-2 hover:bg-[var(--tui-background-neutral-1)]"
                [routerLink]="['/task-management/board', board.uuid]"
              >
                {{ board.name | erpTranslate }}
              </a>
            </li>
          }
        </ul>
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
export class BoardListComponent {
  protected readonly BOARD_KEYS = BOARD_KEYS;

  private readonly _boards = inject(TaskManagementBoardOrchestrator);
  private readonly _router = inject(Router);

  protected readonly loading = signal<boolean>(true);
  protected readonly boards = signal<BoardDto[]>([]);

  public constructor() {
    effect(() => {
      untracked(() => void this._loadAsync());
    });
  }

  private async _loadAsync(): Promise<void> {
    this.loading.set(true);

    try {
      const boards = await this._boards.searchBoardsAsync({});

      // AC1 — jedna widoczna tablica: pomijamy listę i wchodzimy wprost na nią. `replaceUrl`,
      // żeby powrót nie wracał na listę, na której nigdy nie było czego wybierać.
      if (boards.length === 1) {
        await this._router.navigate(['/task-management/board', boards[0].uuid], { replaceUrl: true });
        return;
      }

      this.boards.set(boards);
    } finally {
      this.loading.set(false);
    }
  }
}
