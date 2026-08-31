import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ERP_PERMISSIONS, PermissionStore } from '@erp/shared/auth';
import { ErpButtonBuilder, ErpButtonComponent, ErpButtonConfig, ErpInputBuilder, ErpInputComponent, ErpInputPickerBuilder, ErpInputPickerComponent, ErpInputPickerConfig, ErpTranslatePipe } from '@erp/shared/ui';
import { BoardColumnInput, BoardDto, ProjectWorkflowService, TaskManagementBoardOrchestrator, WorkflowStateDto } from '@erp/task-management/data-access';

import { BOARD_KEYS } from '../translation';

interface ColumnDraft {
  readonly uuid: string;
  name: string;
  stateUuids: string[];
}

/**
 * Konfiguracja tablicy — wybór tablicy projektu, założenie nowej i układ kolumn.
 *
 * <p>Backend miał te komendy od fazy 2, ale nie wołał ich żaden ekran: tablice powstawały
 * wyłącznie w seedzie, a kolumn nie dawało się ruszyć. To jest ta brakująca strona.</p>
 *
 * <p><b>Tutaj, a nie na karcie projektu.</b> Układ kolumn ocenia się patrząc na tablicę —
 * przełączanie się między dwoma ekranami po każdej zmianie kosztowałoby dokładnie tyle, ile
 * ta konfiguracja jest warta. Karta projektu zostaje przy konfiguracji, która tablicy nie
 * dotyczy: polach, stanach, członkach i SLA.</p>
 *
 * <p>Panel jest zwinięty domyślnie i widoczny wyłącznie z uprawnieniem <c>board.manage</c> —
 * codzienna praca na tablicy to przeciąganie kart, nie zmiana jej układu.</p>
 */
@Component({
  selector: 'erp-board-config',
  standalone: true,
  imports: [ErpButtonComponent, ErpInputComponent, ErpInputPickerComponent, ErpTranslatePipe, ReactiveFormsModule],
  template: `
    @if (canManage()) {
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-3">
          <erp-input-picker
            class="w-64"
            [config]="boardPickerConfig()"
            [control]="boardControl"
          />
          <erp-button [config]="toggleButton" />
        </div>

        @if (expanded()) {
          <section class="flex flex-col gap-4 rounded-md border border-[var(--tui-border-normal)] p-4">
            <span class="text-sm font-medium">{{ BOARD_KEYS.config.title | erpTranslate }}</span>

            <div class="flex items-end gap-3">
              <erp-input
                class="w-72"
                [config]="nameInput"
                [formControl]="nameControl"
              />
              <erp-button [config]="renameButton" />
            </div>

            <div class="flex items-end gap-3">
              <erp-input
                class="w-72"
                [config]="newBoardInput"
                [formControl]="newBoardControl"
              />
              <erp-button [config]="createButton" />
            </div>

            <div class="flex flex-col gap-2">
              <span class="text-sm font-medium">{{ BOARD_KEYS.config.columns | erpTranslate }}</span>
              <span class="text-xs text-[var(--tui-text-tertiary)]">{{ BOARD_KEYS.config.statesHint | erpTranslate }}</span>

              @for (column of drafts(); track column.uuid; let index = $index) {
                <div class="flex items-end gap-2">
                  <erp-input
                    class="w-56"
                    [config]="columnNameInput"
                    [formControl]="nameControlFor(column.uuid)"
                  />
                  <erp-input-picker
                    class="w-80"
                    [config]="statePickerConfig()"
                    [control]="stateControlFor(column.uuid)"
                  />
                  <erp-button [config]="moveButton(index, -1)" />
                  <erp-button [config]="moveButton(index, 1)" />
                  <erp-button [config]="removeColumnButton(column.uuid)" />
                </div>
              }

              <div class="flex items-center gap-3">
                <erp-button [config]="addColumnButton" />
                <erp-button [config]="saveColumnsButton" />
              </div>
            </div>
          </section>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardConfigComponent {
  protected readonly BOARD_KEYS = BOARD_KEYS;

  private readonly _boards = inject(TaskManagementBoardOrchestrator);
  private readonly _workflow = inject(ProjectWorkflowService);
  private readonly _permissions = inject(PermissionStore);
  private readonly _router = inject(Router);

  private readonly _projectBoards = signal<readonly BoardDto[]>([]);
  private readonly _states = signal<readonly WorkflowStateDto[]>([]);
  private readonly _drafts = signal<readonly ColumnDraft[]>([]);
  private readonly _saving = signal(false);
  private readonly _nameControls = new Map<string, FormControl<string | null>>();
  private readonly _stateControls = new Map<string, FormControl<string[] | null>>();
  private readonly _buttons = new Map<string, ErpButtonConfig>();

  public readonly board = input.required<BoardDto>();

  protected readonly expanded = signal(false);
  protected readonly canManage = computed(() => this._permissions.has(ERP_PERMISSIONS.TaskManagement.BoardManage));
  protected readonly drafts = computed(() => this._drafts());

  protected readonly boardControl = new FormControl<string | null>(null);
  protected readonly nameControl = new FormControl<string | null>(null);
  protected readonly newBoardControl = new FormControl<string | null>(null);

  protected readonly nameInput = ErpInputBuilder.create((b) => b.setLabel(BOARD_KEYS.config.name));
  protected readonly columnNameInput = ErpInputBuilder.create((b) => b.setLabel(BOARD_KEYS.config.columnName));
  protected readonly newBoardInput = ErpInputBuilder.create((b) => b.setLabel(BOARD_KEYS.config.createName));

  protected readonly boardPickerConfig = computed<ErpInputPickerConfig<BoardDto, string>>(() =>
    ErpInputPickerBuilder.create<ErpInputPickerBuilder<BoardDto, string>>((b) =>
      b
        .setLabel(BOARD_KEYS.config.boards)
        .setItems(computed(() => [...this._projectBoards()]))
        .setLabelKey('name')
        .setValueKey('uuid')
        .setStrategy('single'),
    ),
  );

  protected readonly statePickerConfig = computed<ErpInputPickerConfig<WorkflowStateDto, string>>(() =>
    ErpInputPickerBuilder.create<ErpInputPickerBuilder<WorkflowStateDto, string>>((b) =>
      b
        .setLabel(BOARD_KEYS.config.states)
        .setItems(computed(() => [...this._states()]))
        .setLabelKey('code')
        .setValueKey('uuid')
        .setStrategy('multi'),
    ),
  );

  protected readonly toggleButton: ErpButtonConfig = ErpButtonBuilder.create((b) =>
    b
      .setLabel(BOARD_KEYS.config.toggle)
      .setAppearance('flat')
      .setFn(() => this.expanded.update((value) => !value)),
  );

  protected readonly renameButton: ErpButtonConfig = ErpButtonBuilder.create((b) =>
    b.setLabel(BOARD_KEYS.config.rename).setAppearance('primary').setLoading(this._saving).setFn(() => this._renameAsync()),
  );

  protected readonly createButton: ErpButtonConfig = ErpButtonBuilder.create((b) =>
    b.setLabel(BOARD_KEYS.config.create).setAppearance('accent').setLoading(this._saving).setFn(() => this._createAsync()),
  );

  protected readonly addColumnButton: ErpButtonConfig = ErpButtonBuilder.create((b) =>
    b.setLabel(BOARD_KEYS.config.addColumn).setAppearance('flat').setFn(() => this._addColumn()),
  );

  protected readonly saveColumnsButton: ErpButtonConfig = ErpButtonBuilder.create((b) =>
    b.setLabel(BOARD_KEYS.config.saveColumns).setAppearance('primary').setLoading(this._saving).setFn(() => this._saveColumnsAsync()),
  );

  public constructor() {
    effect(() => {
      const board = this.board();
      untracked(() => {
        this.boardControl.setValue(board.uuid ?? null, { emitEvent: false });
        this.nameControl.setValue(board.name ?? null, { emitEvent: false });
        this._resetDrafts(board);
        void this._loadContextAsync(board);
      });
    });

    this.boardControl.valueChanges.subscribe((uuid) => {
      if (uuid && uuid !== this.board().uuid) void this._router.navigate(['/task-management/board', uuid]);
    });
  }

  protected nameControlFor(columnUuid: string): FormControl<string | null> {
    const existing = this._nameControls.get(columnUuid);
    if (existing) return existing;

    const control = new FormControl<string | null>(this._drafts().find((draft) => draft.uuid === columnUuid)?.name ?? '');
    this._nameControls.set(columnUuid, control);
    return control;
  }

  protected stateControlFor(columnUuid: string): FormControl<string[] | null> {
    const existing = this._stateControls.get(columnUuid);
    if (existing) return existing;

    const control = new FormControl<string[] | null>(this._drafts().find((draft) => draft.uuid === columnUuid)?.stateUuids ?? []);
    this._stateControls.set(columnUuid, control);
    return control;
  }

  protected moveButton(index: number, direction: -1 | 1): ErpButtonConfig {
    return this._button(`move:${index}:${direction}`, direction < 0 ? BOARD_KEYS.config.moveUp : BOARD_KEYS.config.moveDown, () => this._move(index, direction));
  }

  protected removeColumnButton(columnUuid: string): ErpButtonConfig {
    return this._button(`remove:${columnUuid}`, BOARD_KEYS.config.removeColumn, () => this._removeColumn(columnUuid));
  }

  private _button(key: string, label: string, fn: () => void): ErpButtonConfig {
    const existing = this._buttons.get(key);
    if (existing) return existing;

    const config = ErpButtonBuilder.create((b) => b.setLabel(label).setAppearance('flat').setFn(fn));
    this._buttons.set(key, config);
    return config;
  }

  private _resetDrafts(board: BoardDto): void {
    this._nameControls.clear();
    this._stateControls.clear();
    this._drafts.set(
      [...(board.columns ?? [])]
        .sort((left, right) => left.orderNo - right.orderNo)
        .map((column) => ({ uuid: column.uuid, name: column.name, stateUuids: [...column.stateUuids] })),
    );
  }

  private async _loadContextAsync(board: BoardDto): Promise<void> {
    const [boards, workflow] = await Promise.all([
      this._boards.searchBoardsAsync({ projectUuid: board.projectUuid }),
      this._workflow.loadAsync(board.projectUuid),
    ]);

    this._projectBoards.set(boards);
    this._states.set(workflow?.states ?? []);
  }

  private _addColumn(): void {
    this._drafts.update((drafts) => [...drafts, { uuid: crypto.randomUUID(), name: '', stateUuids: [] }]);
  }

  private _removeColumn(columnUuid: string): void {
    this._nameControls.delete(columnUuid);
    this._stateControls.delete(columnUuid);
    this._drafts.update((drafts) => drafts.filter((draft) => draft.uuid !== columnUuid));
  }

  private _move(index: number, direction: -1 | 1): void {
    this._drafts.update((drafts) => {
      const target = index + direction;
      if (target < 0 || target >= drafts.length) return drafts;

      const next = [...drafts];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  private async _renameAsync(): Promise<void> {
    const name = this.nameControl.value?.trim();
    if (!name) return;

    this._saving.set(true);
    try {
      await this._boards.setBoardNameAsync({ uuid: this.board().uuid, name });
      await this._boards.openBoardAsync(this.board().uuid);
    } catch (error) {
      console.error('[BoardConfigComponent] Nie udało się zmienić nazwy tablicy.', error);
    } finally {
      this._saving.set(false);
    }
  }

  private async _createAsync(): Promise<void> {
    const name = this.newBoardControl.value?.trim();
    if (!name) return;

    // Uuid wypełnia klient — jest jednocześnie kluczem idempotencji, więc ponowione żądanie
    // nie zakłada drugiej tablicy (`docs/backend/endpoint-naming.md` §4).
    const uuid = crypto.randomUUID();

    this._saving.set(true);
    try {
      await this._boards.createBoardAsync({ uuid, projectUuid: this.board().projectUuid, name, isDefault: false });
      this.newBoardControl.setValue(null);
      await this._router.navigate(['/task-management/board', uuid]);
    } catch (error) {
      console.error('[BoardConfigComponent] Nie udało się utworzyć tablicy.', error);
    } finally {
      this._saving.set(false);
    }
  }

  private async _saveColumnsAsync(): Promise<void> {
    const columns: BoardColumnInput[] = this._drafts().map((draft, index) => ({
      uuid: draft.uuid,
      name: this._nameControls.get(draft.uuid)?.value?.trim() || draft.name,
      orderNo: index,
      stateUuids: this._stateControls.get(draft.uuid)?.value ?? draft.stateUuids,
    }));

    this._saving.set(true);
    try {
      await this._boards.setColumnsAsync({ uuid: this.board().uuid, columns });
      await this._boards.openBoardAsync(this.board().uuid);
    } catch (error) {
      console.error('[BoardConfigComponent] Nie udało się zapisać układu kolumn.', error);
    } finally {
      this._saving.set(false);
    }
  }
}
