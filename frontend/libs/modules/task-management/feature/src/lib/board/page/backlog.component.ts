import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';

import { ErpButtonBuilder, ErpButtonComponent, ErpDatePickerBuilder, ErpDatePickerComponent, ErpEmptyStateComponent, ErpInputBuilder, ErpInputComponent, ErpTranslatePipe } from '@erp/shared/ui';
import { BoardCardVM, TaskManagementBoardOrchestrator, TaskManagementSprintOrchestrator } from '@erp/task-management/data-access';

import { BoardCardComponent } from '../components/board-card.component';
import { BOARD_KEYS, provideBoardTranslations } from '../translation';
import { BoardStore } from './board.store';

type BacklogDropEvent =
  | CdkDragDrop<undefined, unknown, BoardCardVM>
  | CdkDragDrop<string, unknown, BoardCardVM>;

/** Backlog tablicy scrumowej. To celowy wyjątek od `erp-grid-layout`: dwie listy są obszarem
 * pracy typu drag-and-drop, nie tabelą serwerową (`task-management-pages.md` §2.4). */
@Component({
  selector: 'erp-task-management-backlog',
  standalone: true,
  imports: [BoardCardComponent, CdkDrag, CdkDropList, CdkDropListGroup, ErpButtonComponent, ErpDatePickerComponent, ErpEmptyStateComponent, ErpInputComponent, ErpTranslatePipe, ReactiveFormsModule],
  providers: [BoardStore, provideBoardTranslations()],
  template: `
    @if (store.loading()) {
      <erp-empty-state [config]="{ icon: '@tui.loader', message: BOARD_KEYS.loading }" />
    } @else if (!store.board()) {
      <erp-empty-state [config]="{ icon: '@tui.search-x', message: BOARD_KEYS.notFound }" />
    } @else {
      <div class="flex h-full min-h-0 flex-col gap-4 p-4">
        <span class="text-lg font-medium">{{ BOARD_KEYS.backlog.title | erpTranslate }}</span>

        <form
          class="flex flex-wrap items-end gap-2"
          (ngSubmit)="createSprint()"
        >
          <erp-input
            class="min-w-56"
            [config]="nameInput"
            [control]="name"
          />
          <erp-datepicker
            class="min-w-44"
            [config]="startOnPicker"
            [control]="startOn"
          />
          <erp-datepicker
            class="min-w-44"
            [config]="endOnPicker"
            [control]="endOn"
          />
          <erp-button [config]="createButton" />
        </form>

        <div class="flex flex-wrap gap-2">
          @if (plannedSprint()) {
            <erp-button [config]="startButton" />
          }
          @if (activeSprint()) {
            <erp-button [config]="closeButton" />
            @for (sprint of plannedSprints(); track sprint.uuid) {
              <erp-button [config]="closeToSprintButton(sprint.uuid, sprint.name)" />
            }
          }
        </div>

        <div
          cdkDropListGroup
          class="grid min-h-0 flex-1 grid-cols-2 gap-4"
        >
          <section class="min-h-0 overflow-y-auto rounded border border-[var(--tui-border-normal)] p-3">
            <h2 class="m-0 mb-3 text-sm font-semibold uppercase text-[var(--tui-text-secondary)]">
              {{ BOARD_KEYS.backlog.backlog | erpTranslate }}
            </h2>
            <div
              cdkDropList
              class="flex min-h-24 flex-col gap-2"
              [cdkDropListData]="undefined"
              (cdkDropListDropped)="drop($event)"
            >
              @for (card of backlog(); track card.uuid) {
                <div
                  cdkDrag
                  [cdkDragData]="card"
                >
                  <erp-board-card [card]="card" />
                </div>
              }
            </div>
          </section>

          <section class="min-h-0 overflow-y-auto rounded border border-[var(--tui-border-normal)] p-3">
            <h2 class="m-0 mb-3 text-sm font-semibold uppercase text-[var(--tui-text-secondary)]">
              {{ activeSprint() ? activeSprint()!.name : (BOARD_KEYS.backlog.noActive | erpTranslate) }}
            </h2>
            @if (activeSprint(); as sprint) {
              <div
                cdkDropList
                class="flex min-h-24 flex-col gap-2"
                [cdkDropListData]="sprint.uuid"
                (cdkDropListDropped)="drop($event)"
              >
                @for (card of sprintCards(); track card.uuid) {
                  <div
                    cdkDrag
                    [cdkDragData]="card"
                  >
                    <erp-board-card [card]="card" />
                  </div>
                }
              </div>
            }
          </section>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BacklogComponent {
  protected readonly BOARD_KEYS = BOARD_KEYS;
  protected readonly store = inject(BoardStore);

  private readonly _boards = inject(TaskManagementBoardOrchestrator);
  private readonly _sprints = inject(TaskManagementSprintOrchestrator);
  private readonly _route = inject(ActivatedRoute);
  private readonly _uuid = toSignal(this._route.paramMap.pipe(map((params) => params.get('uuid') ?? '')), {
    initialValue: '',
  });

  protected readonly sprints = computed(() => [...this._sprints.getViewModel()().values()]);
  protected readonly activeSprint = computed(() => this.sprints().find((sprint) => sprint.status === 1));
  protected readonly backlog = computed(() => this._boards.cards().filter((card) => !card.sprintUuid));
  protected readonly sprintCards = computed(() => this._boards.cards().filter((card) => card.sprintUuid === this.activeSprint()?.uuid));
  protected readonly plannedSprint = computed(() => this.sprints().find((sprint) => sprint.status === 0));
  protected readonly plannedSprints = computed(() => this.sprints().filter((sprint) => sprint.status === 0));

  protected readonly name = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  protected readonly startOn = new FormControl<Date | null>(null, Validators.required);
  protected readonly endOn = new FormControl<Date | null>(null, Validators.required);

  protected readonly nameInput = ErpInputBuilder.create((b) => b.setLabel(BOARD_KEYS.backlog.name));
  protected readonly startOnPicker = ErpDatePickerBuilder.create((b) => b.setLabel(BOARD_KEYS.backlog.start));
  protected readonly endOnPicker = ErpDatePickerBuilder.create((b) => b.setLabel(BOARD_KEYS.backlog.end));
  protected readonly createButton = ErpButtonBuilder.create((b) =>
    b
      .setLabel(BOARD_KEYS.backlog.create)
      .setAppearance('primary')
      .setFn(() => this.createSprint()),
  );
  protected readonly startButton = ErpButtonBuilder.create((b) =>
    b
      .setLabel(BOARD_KEYS.backlog.startSprint)
      .setAppearance('primary')
      .setFn(() => this._startSprint()),
  );
  protected readonly closeButton = ErpButtonBuilder.create((b) =>
    b
      .setLabel(BOARD_KEYS.backlog.closeSprint)
      .setAppearance('destructive')
      .setFn(() => this.closeSprint()),
  );

  public constructor() {
    effect(() => {
      const uuid = this._uuid();
      if (uuid) {
        untracked(() => void this._openAsync(uuid));
      }
    });
  }

  protected closeToSprintButton(sprintUuid: string, sprintName: string): ReturnType<typeof ErpButtonBuilder.create> {
    return ErpButtonBuilder.create((b) =>
      b
        .setLabel({ key: BOARD_KEYS.backlog.closeToSprint, params: { name: sprintName } })
        .setAppearance('secondary')
        .setFn(() => this.closeSprint(sprintUuid)),
    );
  }

  protected drop(event: BacklogDropEvent): void {
    const targetSprintUuid = event.container.data;
    const card = event.item.data;

    if (card.sprintUuid !== targetSprintUuid) {
      this._move(card, targetSprintUuid);
    }
  }

  private async _openAsync(boardUuid: string): Promise<void> {
    await this.store.openAsync(boardUuid);
    await this._sprints.searchAsync({ boardUuid, page: 1, pageSize: 100 });
  }

  private _move(card: BoardCardVM, sprintUuid?: string): void {
    const boardUuid = this.store.board()?.uuid;
    if (boardUuid) {
      void this._sprints.setIssueSprintAsync({ uuid: card.issueUuid, boardUuid, sprintUuid });
    }
  }

  protected async createSprint(): Promise<void> {
    const boardUuid = this.store.board()?.uuid;
    const name = this.name.value.trim();
    const startOn = this.startOn.value;
    const endOn = this.endOn.value;

    if (!boardUuid || !name || !startOn || !endOn || this.name.invalid || this.startOn.invalid || this.endOn.invalid) {
      return;
    }

    await this._sprints.createAsync({ uuid: crypto.randomUUID(), boardUuid, name, startOn, endOn });
    this.name.reset();
    this.startOn.reset();
    this.endOn.reset();
    await this._sprints.searchAsync({ boardUuid, page: 1, pageSize: 100 });
  }

  private async _startSprint(): Promise<void> {
    const sprint = this.plannedSprint();
    if (sprint) {
      await this._sprints.startAsync({ uuid: sprint.uuid });
      await this._sprints.searchAsync({ boardUuid: sprint.boardUuid, page: 1, pageSize: 100 });
    }
  }

  protected async closeSprint(nextSprintUuid?: string): Promise<void> {
    const sprint = this.activeSprint();
    if (sprint) {
      await this._sprints.closeAsync({
        uuid: sprint.uuid,
        openIssuesDisposition: nextSprintUuid ? 1 : 0,
        nextSprintUuid,
      });
      await this._sprints.searchAsync({ boardUuid: sprint.boardUuid, page: 1, pageSize: 100 });
      await this._boards.refreshCardsAsync();
    }
  }
}
