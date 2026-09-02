import { CdkDragDrop, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { ErpEmptyStateComponent, ErpTranslatePipe } from '@erp/shared/ui';
import { BOARD_MODE, BOARD_SWIMLANE_MODE } from '@erp/task-management/util';

import { BoardColumnComponent } from '../components/board-column.component';
import { BOARD_KEYS, provideBoardTranslations } from '../translation';
import { BoardStore } from './board.store';

/**
 * Strona `/task-management/board/:uuid` — tablica kanban.
 *
 * <p><b>Świadomie łamie wzorzec `erp-grid-layout` + filtr + tabela</b> i jest to zapisane,
 * żeby przy review nie wyglądało na niedbalstwo: kolumny są poziomą listą przewijaną w bok,
 * a nie treścią jednego obszaru siatki. Drugi taki przypadek w systemie po edytorze szablonu
 * obiegu w DMS (`docs/frontend/task-management-pages.md` §2.2).</p>
 *
 * <p>Swimlane'y (podział poziomy po przypisanym albo epiku) świadomie nie wchodzą w fazie 2 —
 * są drugim wymiarem grupowania nad tym samym mechanizmem kolejności, a to fazę 2 ma
 * rozstrzygnąć: uporządkowaną kolekcję i współbieżną edycję.</p>
 */
@Component({
  selector: 'erp-task-management-board',
  standalone: true,
  imports: [BoardColumnComponent, CdkDropListGroup, ErpEmptyStateComponent, ErpTranslatePipe, RouterLink],
  providers: [BoardStore, provideBoardTranslations()],
  template: `
    @let board = this.board();

    @if (this.loading()) {
      <erp-empty-state [config]="{ icon: '@tui.loader', message: BOARD_KEYS.loading }" />
    } @else if (!board) {
      <erp-empty-state [config]="{ icon: '@tui.search-x', message: BOARD_KEYS.notFound }" />
    } @else {
      <div class="flex h-full min-h-0 w-full flex-col gap-3 p-4">
        <div class="flex items-center justify-between gap-2">
          <span class="text-lg font-medium">{{ board.name | erpTranslate }}</span>

          <div class="flex items-center gap-3">
            <label class="flex items-center gap-1 text-xs text-[var(--tui-text-tertiary)]">
              {{ BOARD_KEYS.swimlane.groupBy | erpTranslate }}
              <select
                class="rounded border border-[var(--tui-border-normal)] bg-transparent px-1 py-0.5 text-xs"
                [value]="board.swimlaneMode"
                (change)="this.onSwimlaneModeChange(board.uuid, $any($event.target).value)"
              >
                <option [value]="BOARD_SWIMLANE_MODE.None">{{ BOARD_KEYS.swimlane.mode.none | erpTranslate }}</option>
                <option [value]="BOARD_SWIMLANE_MODE.Assignee">
                  {{ BOARD_KEYS.swimlane.mode.assignee | erpTranslate }}
                </option>
                <option [value]="BOARD_SWIMLANE_MODE.Epic">{{ BOARD_KEYS.swimlane.mode.epic | erpTranslate }}</option>
                <option [value]="BOARD_SWIMLANE_MODE.Priority">
                  {{ BOARD_KEYS.swimlane.mode.priority | erpTranslate }}
                </option>
              </select>
            </label>

            @if (board.mode === BOARD_MODE.Scrum) {
              <a class="text-sm underline" [routerLink]="['/task-management/board', board.uuid, 'backlog']">
                {{ BOARD_KEYS.backlog.title | erpTranslate }}
              </a>
            }
          </div>
        </div>

        @if (this.columns().length === 0) {
          <erp-empty-state [config]="{ icon: '@tui.columns-3', message: BOARD_KEYS.empty.columns }" />
        } @else {
          <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            @for (swimlane of this.swimlanes(); track swimlane.key) {
              <div class="flex min-h-0 flex-col gap-2" cdkDropListGroup>
                @if (swimlane.label) {
                  <span class="px-1 text-xs font-medium text-[var(--tui-text-tertiary)]">{{ swimlane.label }}</span>
                }

                <div class="flex min-h-0 flex-1 gap-3 overflow-x-auto">
                  @for (column of swimlane.columns; track column.uuid) {
                    <erp-board-column
                      [column]="column"
                      [enabled]="this.allowedColumnUuids().has(column.uuid)"
                      (dragStarted)="this.store.startDrag($event)"
                      (dragEnded)="this.store.endDrag()"
                      (dropped)="this.onDropped(swimlane.key, $event)"
                    />
                  }
                </div>
              </div>
            }
          </div>
        }
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
export class BoardComponent {
  protected readonly BOARD_KEYS = BOARD_KEYS;
  protected readonly BOARD_MODE = BOARD_MODE;
  protected readonly BOARD_SWIMLANE_MODE = BOARD_SWIMLANE_MODE;

  protected readonly store = inject(BoardStore);

  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);

  /** Uuid tablicy z trasy. Czytany z `ActivatedRoute`, a nie przez `input()` z wiązaniem
   * parametrów — host nie włącza `withComponentInputBinding()`, a włączenie go dla jednej
   * strony zmieniłoby wiązanie parametrów we wszystkich modułach naraz. */
  protected readonly uuid = toSignal(this._route.paramMap.pipe(map((params) => params.get('uuid') ?? '')), {
    initialValue: '',
  });

  protected readonly loading = this.store.loading;
  protected readonly board = this.store.board;
  protected readonly columns = this.store.columns;
  protected readonly swimlanes = this.store.swimlanes;
  protected readonly allowedColumnUuids = this.store.allowedColumnUuids;

  public constructor() {
    effect(() => {
      const uuid = this.uuid();

      untracked(() => void (uuid ? this.store.openAsync(uuid) : this._openDefaultAsync()));
    });
  }

  /**
   * Upuszczenie karty. Z CDK bierzemy wyłącznie <b>gdzie</b> ją upuszczono — samego przesunięcia
   * w tablicy nie robimy tu ręcznie: widok liczy się z sygnału kart, a optymistyczne
   * przesunięcie trzyma store, żeby cofnięcie po nieudanym zadaniu miało jedno miejsce.
   */
  protected onDropped(swimlaneKey: string, event: CdkDragDrop<string>): void {
    const cardUuid = this._cardUuidAt(swimlaneKey, event.previousContainer.data, event.previousIndex);

    this.store.endDrag();

    if (!cardUuid) {
      return;
    }

    void this.store.dropAsync(swimlaneKey, event.container.data, cardUuid, event.currentIndex);
  }

  /**
   * Wejście z menu, bez uuid-a w adresie: rozwiązujemy tablicę domyślną i <b>podmieniamy
   * adres</b> na konkretną (`replaceUrl`, więc „wstecz" nie wraca do trasy bez uuid-a).
   * Bez tej podmiany użytkownik nie miałby czego skopiować, żeby pokazać komuś tę samą tablicę.
   */
  private async _openDefaultAsync(): Promise<void> {
    const uuid = await this.store.resolveDefaultBoardUuidAsync();

    if (!uuid) {
      this.store.loading.set(false);
      return;
    }

    await this._router.navigate(['/task-management/board', uuid], { replaceUrl: true });
  }

  /** BRD-006 — grupowanie po polu niestandardowym wymaga dodatkowo kodu pola; wybór z tego
   * prostego przełącznika w nagłówku ogranicza się do trybów bez parametru. */
  protected onSwimlaneModeChange(boardUuid: string, rawMode: string): void {
    void this.store.setSwimlaneAsync({ uuid: boardUuid, mode: Number(rawMode), fieldCode: undefined });
  }

  private _cardUuidAt(swimlaneKey: string, columnUuid: string, index: number): string | undefined {
    const swimlane = this.store.swimlanes().find((lane) => lane.key === swimlaneKey);
    return swimlane?.columns.find((column) => column.uuid === columnUuid)?.cards[index]?.uuid;
  }
}
