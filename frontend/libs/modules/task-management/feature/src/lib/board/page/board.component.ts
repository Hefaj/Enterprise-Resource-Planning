import { CdkDragDrop, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { ErpEmptyStateComponent, ErpTranslatePipe } from '@erp/shared/ui';

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
  imports: [BoardColumnComponent, CdkDropListGroup, ErpEmptyStateComponent, ErpTranslatePipe],
  providers: [BoardStore, provideBoardTranslations()],
  template: `
    @let board = this.board();

    @if (this.loading()) {
      <erp-empty-state [config]="{ icon: '@tui.loader', message: BOARD_KEYS.loading }" />
    } @else if (!board) {
      <erp-empty-state [config]="{ icon: '@tui.search-x', message: BOARD_KEYS.notFound }" />
    } @else {
      <div class="flex h-full min-h-0 w-full flex-col gap-3 p-4">
        <span class="text-lg font-medium">{{ board.name | erpTranslate }}</span>

        @if (this.columns().length === 0) {
          <erp-empty-state [config]="{ icon: '@tui.columns-3', message: BOARD_KEYS.empty.columns }" />
        } @else {
          <div class="flex min-h-0 flex-1 gap-3 overflow-x-auto" cdkDropListGroup>
            @for (column of this.columns(); track column.uuid) {
              <erp-board-column
                [column]="column"
                [enabled]="this.allowedColumnUuids().has(column.uuid)"
                (dragStarted)="this.store.startDrag($event)"
                (dragEnded)="this.store.endDrag()"
                (dropped)="this.onDropped($event)"
              />
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
  protected onDropped(event: CdkDragDrop<string>): void {
    const cardUuid = this._cardUuidAt(event.previousContainer.data, event.previousIndex);

    this.store.endDrag();

    if (!cardUuid) {
      return;
    }

    void this.store.dropAsync(event.container.data, cardUuid, event.currentIndex);
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

  private _cardUuidAt(columnUuid: string, index: number): string | undefined {
    return this.columns().find((column) => column.uuid === columnUuid)?.cards[index]?.uuid;
  }
}
