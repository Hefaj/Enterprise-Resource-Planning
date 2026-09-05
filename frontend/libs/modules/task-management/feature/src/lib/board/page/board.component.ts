import { CdkDragDrop, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';

import {
  ErpEmptyStateComponent,
  ErpButtonComponent,
  ErpButtonConfig,
  ErpInputBuilder,
  ErpInputConfig,
  ErpInputPickerBuilder,
  ErpInputPickerConfig,
} from '@erp/shared/ui';
import { BoardDto, TaskManagementTagOrchestrator } from '@erp/task-management/data-access';
import { BOARD_MODE, BOARD_SWIMLANE_MODE, ISSUE_PRIORITY } from '@erp/task-management/util';
import {
  ErpBoardColumnComponent,
  ErpBoardColumnConfig,
  ErpBoardToolbarComponent,
  ErpBoardToolbarConfig,
  ErpIssueCardConfig,
  TASKMANAGEMENT_KEYS,
} from '@erp/task-management/ui';

import { BOARD_KEYS, provideBoardTranslations } from '../translation';
import { BoardColumnVM, BoardStore } from './board.store';

/**
 * Strona `/task-management/board/:uuid` — tablica kanban.
 *
 * <p><b>Świadomie łamie wzorzec `erp-grid-layout` + filtr + tabela</b> i jest to zapisane,
 * żeby przy review nie wyglądało na niedbalstwo: kolumny są poziomą listą przewijaną w bok,
 * a nie treścią jednego obszaru siatki. Drugi taki przypadek w systemie po edytorze szablonu
 * obiegu w DMS (`docs/modules/task-management/screens.md` §2.2).</p>
 *
 * <p>Swimlane'y (BRD-006) dzielą te same kolumny po przypisanym, epiku, priorytecie lub
 * skonfigurowanym polu niestandardowym. Store zachowuje kolejność w granicach wiersza, więc
 * upuszczenie karty liczy sąsiadów tylko w aktualnym swimlane'ie.</p>
 */
@Component({
  selector: 'erp-task-management-board',
  standalone: true,
  imports: [
    ErpBoardColumnComponent,
    ErpBoardToolbarComponent,
    ErpButtonComponent,
    CdkDropListGroup,
    ErpEmptyStateComponent,
  ],
  providers: [BoardStore, provideBoardTranslations()],
  template: `
    @let board = this.board();

    @if (this.loading()) {
      <erp-empty-state [config]="{ icon: '@tui.loader', message: BOARD_KEYS.loading }" />
    } @else if (!board) {
      <erp-empty-state [config]="{ icon: '@tui.search-x', message: BOARD_KEYS.notFound }" />
    } @else {
      <div class="flex h-full min-h-0 w-full flex-col gap-3 p-4">
        <erp-board-toolbar
          [config]="this.toolbarConfig(board)"
          [swimlaneModeControl]="this.swimlaneModeControl"
          [swimlaneFieldCodeControl]="this.swimlaneFieldCodeControl"
        />

        @if (this.columns().length === 0) {
          <erp-empty-state [config]="{ icon: '@tui.columns-3', message: BOARD_KEYS.empty.columns }" />
        } @else {
          <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            @for (swimlane of this.swimlanes(); track swimlane.key) {
              <div class="flex min-h-0 flex-col gap-2" cdkDropListGroup>
                @if (swimlane.label) {
                  <div class="flex items-center gap-1 px-1">
                    <span class="text-xs font-medium text-[var(--tui-text-tertiary)]">{{ swimlane.label }}</span>
                    <erp-button [config]="this.swimlaneToggleButton(swimlane.key)" />
                  </div>
                }

                @if (!this.collapsedSwimlanes().has(swimlane.key)) {
                  <div class="flex min-h-0 flex-1 gap-3 overflow-x-auto">
                    @for (column of swimlane.columns; track column.uuid) {
                      <erp-board-column
                        [config]="this.columnConfig(column)"
                        (dragStarted)="this.store.startDrag($event)"
                        (dragEnded)="this.store.endDrag()"
                        (dropped)="this.onDropped(swimlane.key, $event)"
                        (cardMoveRequested)="this.onCardMoveRequested(swimlane, $event)"
                      />
                    }
                  </div>
                }
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
  private readonly _tags = inject(TaskManagementTagOrchestrator);

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

  /** Kontekstowy wybór sposobu grupowania — używamy wspólnego pickera, zamiast lokalnego
   * `<select>`, aby zachować obsługę klawiatury, fokus i tłumaczenia identyczne z filtrami. */
  protected readonly swimlaneModeControl = new FormControl<number>(BOARD_SWIMLANE_MODE.None, { nonNullable: true });
  protected readonly selectedSwimlaneMode = signal<number>(BOARD_SWIMLANE_MODE.None);
  protected readonly collapsedSwimlanes = signal<ReadonlySet<string>>(new Set());
  protected readonly swimlaneFieldCodeControl = new FormControl<string>('', { nonNullable: true });
  protected readonly swimlaneFieldCodeInputConfig: ErpInputConfig = ErpInputBuilder.create((builder) =>
    builder
      .setLabel(BOARD_KEYS.swimlane.fieldCode.label)
      .setPlaceholder(BOARD_KEYS.swimlane.fieldCode.placeholder)
      .setSize('s'),
  );

  protected readonly swimlanePickerConfig = computed<ErpInputPickerConfig>(() =>
    ErpInputPickerBuilder.create((b) =>
      b
        .setLabel(BOARD_KEYS.swimlane.groupBy)
        .setItems([
          { value: BOARD_SWIMLANE_MODE.None, label: BOARD_KEYS.swimlane.mode.none },
          { value: BOARD_SWIMLANE_MODE.Assignee, label: BOARD_KEYS.swimlane.mode.assignee },
          { value: BOARD_SWIMLANE_MODE.Epic, label: BOARD_KEYS.swimlane.mode.epic },
          { value: BOARD_SWIMLANE_MODE.Priority, label: BOARD_KEYS.swimlane.mode.priority },
          { value: BOARD_SWIMLANE_MODE.CustomField, label: BOARD_KEYS.swimlane.mode.customField },
        ])
        .setLabelKey('label')
        .setValueKey('value')
        .setStrategy('single')
        .setSize('s'),
    ),
  );

  public constructor() {
    effect(() => {
      const uuid = this.uuid();

      untracked(() => void (uuid ? this.store.openAsync(uuid) : this._openDefaultAsync()));
    });

    // Tagi widoczne na projekcie tablicy — wyłącznie po to, żeby karty miały nazwy do pokazania
    // (`BoardCardDto.tagUuids` niesie tylko identyfikatory), ten sam wzorzec co lista zgłoszeń.
    effect(() => {
      const projectUuid = this.board()?.projectUuid;
      untracked(() => void this._tags.searchTagsAsync({ projectUuid }));
    });

    effect(() => {
      const mode = this.board()?.swimlaneMode;
      if (mode !== undefined) {
        untracked(() => {
          this.swimlaneModeControl.setValue(mode, { emitEvent: false });
          this.selectedSwimlaneMode.set(mode);
        });
      }

      untracked(() => this.swimlaneFieldCodeControl.setValue(this.board()?.swimlaneFieldCode ?? '', { emitEvent: false }));
    });

    this.swimlaneModeControl.valueChanges.subscribe((mode) => {
      this.selectedSwimlaneMode.set(mode);
      this._saveSwimlane(mode);
    });

    this.swimlaneFieldCodeControl.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      if (this.swimlaneModeControl.value === BOARD_SWIMLANE_MODE.CustomField) {
        this._saveSwimlane(BOARD_SWIMLANE_MODE.CustomField);
      }
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
   * Klawiaturowa alternatywa przeciągania (WCAG 2.1.1) — przenosi kartę do najbliższej
   * DOSTĘPNEJ kolumny w danym kierunku, na sam początek. Pomija kolumny wygaszone tak samo,
   * jak `acceptDrop` robi to dla myszy — klawiatura nie ma prawa obejść tej samej reguły.
   */
  protected onCardMoveRequested(swimlane: { key: string; columns: readonly BoardColumnVM[] }, event: { cardUuid: string; direction: 'next' | 'prev' }): void {
    const currentIndex = swimlane.columns.findIndex((column) => column.cards.some((card) => card.uuid === event.cardUuid));

    if (currentIndex === -1) {
      return;
    }

    const step = event.direction === 'next' ? 1 : -1;
    const allowed = this.allowedColumnUuids();

    for (let index = currentIndex + step; index >= 0 && index < swimlane.columns.length; index += step) {
      const target = swimlane.columns[index];

      if (allowed.has(target.uuid)) {
        void this.store.dropAsync(swimlane.key, target.uuid, event.cardUuid, 0);
        return;
      }
    }
  }

  protected swimlaneToggleButton(swimlaneKey: string): ErpButtonConfig {
    const collapsed = this.collapsedSwimlanes().has(swimlaneKey);
    return {
      label: collapsed ? BOARD_KEYS.swimlane.expand : BOARD_KEYS.swimlane.collapse,
      appearance: 'flat',
      size: 'xs',
      iconStart: collapsed ? '@tui.chevron-right' : '@tui.chevron-down',
      fn: (): void => {
        this.collapsedSwimlanes.update((current) => {
          const next = new Set(current);

          if (collapsed) {
            next.delete(swimlaneKey);
          } else {
            next.add(swimlaneKey);
          }

          return next;
        });
      },
    };
  }

  /** Adapter granicy feature → ui dla `erp-board-toolbar`. */
  protected toolbarConfig(board: BoardDto): ErpBoardToolbarConfig {
    return {
      boardName: board.name,
      swimlanePickerConfig: this.swimlanePickerConfig(),
      swimlaneFieldCodeInputConfig:
        this.selectedSwimlaneMode() === BOARD_SWIMLANE_MODE.CustomField ? this.swimlaneFieldCodeInputConfig : undefined,
      backlogLink:
        board.mode === BOARD_MODE.Scrum
          ? { routerLink: ['/task-management/board', board.uuid, 'backlog'], labelKey: BOARD_KEYS.backlog.title }
          : undefined,
    };
  }

  /** Adapter granicy feature → ui: UI nie zna DTO, store'a ani reguł workflow. */
  protected columnConfig(column: BoardColumnVM): ErpBoardColumnConfig {
    return {
      uuid: column.uuid,
      name: column.name,
      cards: column.cards.map((card) => ({ uuid: card.uuid, card: this._cardConfig(card) })),
      enabled: this.allowedColumnUuids().has(column.uuid),
      wipLimit: column.wipLimit,
      countLabelKey: BOARD_KEYS.column.count,
      wipExceededLabelKey: BOARD_KEYS.column.wipExceeded,
      emptyLabelKey: BOARD_KEYS.empty.column,
      cardKeyboardHintKey: BOARD_KEYS.column.cardKeyboardHint,
    };
  }

  private _cardConfig(card: BoardColumnVM['cards'][number]): ErpIssueCardConfig {
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
      tags: this._tagChips(card.tagUuids),
      estimateMinutes: card.estimateMinutes,
      disabled: this.store.pendingCardUuid() === card.uuid,
    };
  }

  /** Nazwy tagów rozwiązane z orkiestratora — karta dostaje chipsy gotowe do narysowania,
   * bez znajomości cache'u tagów. */
  private _tagChips(tagUuids: readonly string[]): { value: string; label: string; translate: false }[] {
    const viewModels = this._tags.getViewModel()();

    return tagUuids
      .map((uuid) => viewModels.get(uuid)?.name)
      .filter((name): name is string => !!name)
      .map((name) => ({ value: name, label: name, translate: false as const }));
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

  private _saveSwimlane(mode: number): void {
    const board = this.board();
    if (!board) {
      return;
    }

    const fieldCode = mode === BOARD_SWIMLANE_MODE.CustomField ? this.swimlaneFieldCodeControl.value.trim() || undefined : undefined;
    if (mode === BOARD_SWIMLANE_MODE.CustomField && !fieldCode) {
      return;
    }
    if (mode === board.swimlaneMode && fieldCode === board.swimlaneFieldCode) {
      return;
    }

    void this.store.setSwimlaneAsync({ uuid: board.uuid, mode, fieldCode });
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

  private _cardUuidAt(swimlaneKey: string, columnUuid: string, index: number): string | undefined {
    const swimlane = this.store.swimlanes().find((lane) => lane.key === swimlaneKey);
    return swimlane?.columns.find((column) => column.uuid === columnUuid)?.cards[index]?.uuid;
  }
}
