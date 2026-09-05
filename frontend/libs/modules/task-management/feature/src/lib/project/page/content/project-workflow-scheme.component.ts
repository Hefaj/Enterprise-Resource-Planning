import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslocoService } from '@jsverse/transloco';

import {
  ErpButtonComponent,
  ErpButtonConfig,
  ErpConfirmDialogService,
  ErpInputBuilder,
  ErpInputComponent,
  ErpInputConfig,
  ErpInputPickerBuilder,
  ErpInputPickerComponent,
  ErpInputPickerConfig,
  ErpModalService,
  ErpRowActionsCellComponent,
  ErpTableBuilder,
  ErpTableComponent,
  ErpTableConfig,
  ErpTranslatePipe,
} from '@erp/shared/ui';
import {
  ProjectVM,
  TaskManagementWorkflowSchemeOrchestrator,
  WorkflowSchemeDto,
  WorkflowStateDto,
  WorkflowTransitionDto,
} from '@erp/task-management/data-access';
import { WORKFLOW_SCHEME_PUBLISH_MODAL_ID, WORKFLOW_STATE_CATEGORY } from '@erp/task-management/util';
import {
  ErpProjectConfigurationSectionComponent,
  ErpProjectConfigurationSectionConfig,
  ErpWorkflowEditorComponent,
  ErpWorkflowEditorConfig,
  ErpWorkflowEditorSelectedCell,
  ErpWorkflowTransitionCellConfig,
} from '@erp/task-management/ui';

import { WorkflowSchemePublishMetadata } from '../../modal/workflow-scheme-publish/workflow-scheme-publish.definition';
import { PROJECT_KEYS } from '../../translation';

interface MatrixCell {
  readonly fromState: WorkflowStateDto;
  readonly toState: WorkflowStateDto;
  readonly transition: WorkflowTransitionDto | undefined;
}

/**
 * Zakładka schematu stanów na karcie projektu (`WF-006`/`WF-007`,
 * `docs/modules/task-management/screens.md` §4.3).
 *
 * <p><b>Nie canvas grafu</b> — automat jest sekwencyjny, więc dwie listy (stany, przejścia) plus
 * macierz „z→do" są tańsze i czytelniejsze niż rysowanie (decyzja architektoniczna, nie
 * niedoróbka). Schemat żyje na karcie projektu, tak samo jak typy zgłoszeń (faza 4) — świadome
 * odstępstwo od trasy `/task-management/workflow-scheme/:uuid` wspomnianej w §4.3 dokumentu stron,
 * dla spójności z decyzją podjętą przy typach.</p>
 *
 * <p>Usunięcie stanu bez otwartych zgłoszeń idzie wprost (`removeStateAsync`). Stan z otwartymi
 * zgłoszeniami pivotuje do modalu publikacji z mapowaniem (WF-006) — podgląd
 * (`GetWorkflowSchemePublishPreview`) mówi, który przypadek to jest, więc front nigdy nie zgaduje.</p>
 */
@Component({
  selector: 'erp-task-management-project-workflow-scheme',
  standalone: true,
  imports: [
    ErpButtonComponent,
    ErpInputComponent,
    ErpInputPickerComponent,
    ErpProjectConfigurationSectionComponent,
    ErpTableComponent,
    ErpTranslatePipe,
    ErpWorkflowEditorComponent,
    ReactiveFormsModule,
  ],
  template: `
    <erp-project-configuration-section [config]="this.sectionConfig" class="block">
      @let scheme = this.scheme();

      @if (this.loadingScheme()) {
        <span class="text-sm text-[var(--tui-text-secondary)]">
          {{ PROJECT_KEYS.detail.workflow.loading | erpTranslate }}
        </span>
      } @else if (this.schemeLoadError()) {
        <div class="flex flex-col items-start gap-2">
          <span class="text-sm text-[var(--tui-status-negative)]">
            {{ PROJECT_KEYS.detail.workflow.loadError | erpTranslate }}
          </span>
          <erp-button [config]="retrySchemeButton" />
        </div>
      } @else if (!scheme) {
        <span class="text-sm text-[var(--tui-text-secondary)]">
          {{ PROJECT_KEYS.detail.workflow.noScheme | erpTranslate }}
        </span>
      } @else {
        <!-- Stany -->
        <div class="flex flex-col gap-3">
          <span class="text-sm font-medium">{{ PROJECT_KEYS.detail.workflow.states.title | erpTranslate }}</span>

          @if (this.states().length === 0) {
            <span class="text-sm text-[var(--tui-text-secondary)]">
              {{ PROJECT_KEYS.detail.workflow.states.empty | erpTranslate }}
            </span>
          } @else {
            <erp-table class="block h-64 w-full" [config]="this.statesTableConfig(scheme)" />
          }

          <div class="flex flex-col gap-3 rounded-md border border-[var(--tui-border-normal)] p-4">
            <span class="text-sm font-medium">{{ PROJECT_KEYS.detail.workflow.states.add.title | erpTranslate }}</span>

            <div class="grid grid-cols-3 gap-3">
              <erp-input [config]="this.stateCodeInput" [control]="this.stateCodeControl" />
              <erp-input [config]="this.stateNameKeyInput" [control]="this.stateNameKeyControl" />
              <erp-input-picker [config]="this.categoryPickerConfig()" [control]="this.stateCategoryControl" />
            </div>

            <div class="flex justify-end">
              <erp-button [config]="this.addStateButton(scheme)" />
            </div>
          </div>
        </div>

        <!-- Przejścia: macierz z → do -->
        <erp-workflow-editor [config]="this.editorConfig(scheme)" />
      }
    </erp-project-configuration-section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectWorkflowSchemeComponent {
  protected readonly PROJECT_KEYS = PROJECT_KEYS;
  protected readonly sectionConfig: ErpProjectConfigurationSectionConfig = { title: PROJECT_KEYS.detail.workflow.title };

  private readonly _schemes = inject(TaskManagementWorkflowSchemeOrchestrator);
  private readonly _confirm = inject(ErpConfirmDialogService);
  private readonly _modalService = inject(ErpModalService);
  private readonly _transloco = inject(TranslocoService);

  public readonly project = input.required<ProjectVM>();

  private readonly _saving = signal<boolean>(false);

  protected readonly scheme = computed<WorkflowSchemeDto | undefined>(() => {
    const uuid = this.project().workflowSchemeUuid;
    return uuid ? this._schemes.getOne(uuid)() : undefined;
  });

  /** Błąd nie może udawać „brak schematu" — inaczej użytkownik widzi zachętę do skonfigurowania
   * czegoś, co jest w rzeczywistości już podpięte, tylko przejściowo niedostępne. */
  protected readonly loadingScheme = signal<boolean>(false);
  protected readonly schemeLoadError = signal<boolean>(false);
  protected readonly retrySchemeButton: ErpButtonConfig = {
    label: PROJECT_KEYS.detail.workflow.retry,
    appearance: 'outline',
    size: 's',
    fn: (): void => this.retrySchemeLoad(),
  };

  protected readonly states = computed<WorkflowStateDto[]>(() =>
    [...(this.scheme()?.states ?? [])].sort((a, b) => a.orderNo - b.orderNo),
  );

  protected readonly transitions = computed<WorkflowTransitionDto[]>(() => this.scheme()?.transitions ?? []);

  protected statesTableConfig(scheme: WorkflowSchemeDto): ErpTableConfig<WorkflowStateDto> {
    return new ErpTableBuilder<WorkflowStateDto>()
      .setMode('client')
      .setRowIdAccessor((row) => row.uuid)
      .setItems(this.states())
      .setSelectionMode('none')
      .setEmptyMessage(PROJECT_KEYS.detail.workflow.states.empty)
      .addColumn((c) =>
        c
          .setId('code')
          .setAccessorKey('code')
          .setHeader(PROJECT_KEYS.detail.workflow.states.columns.code)
          .setCellClass('font-mono text-xs'),
      )
      .addColumn((c) =>
        c.setId('name').setAccessorFn((row) => this._t(row.nameKey)).setHeader(PROJECT_KEYS.detail.workflow.states.columns.name),
      )
      .addColumn((c) =>
        c
          .setId('category')
          .setAccessorFn((row) => this._t(this.categoryKey(row.category)))
          .setHeader(PROJECT_KEYS.detail.workflow.states.columns.category),
      )
      .addColumn((c) =>
        c
          .setId('actions')
          .setHeader('')
          .setEnableSorting(false)
          .setSize(90)
          .setGrow(0)
          .setCell(ErpRowActionsCellComponent, { getActions: (row: WorkflowStateDto) => [this.removeStateButton(scheme, row)] }),
      )
      .build();
  }

  // ── Formularz dodania stanu ──

  protected readonly stateCodeControl = new FormControl<string | null>(null);
  protected readonly stateNameKeyControl = new FormControl<string | null>(null);
  protected readonly stateCategoryControl = new FormControl<number | null>(WORKFLOW_STATE_CATEGORY.Todo);

  protected readonly stateCodeInput: ErpInputConfig = ErpInputBuilder.create((b) =>
    b.setLabel(PROJECT_KEYS.detail.workflow.states.add.code).setHint(PROJECT_KEYS.detail.workflow.states.add.codeHint),
  );

  protected readonly stateNameKeyInput: ErpInputConfig = ErpInputBuilder.create((b) =>
    b.setLabel(PROJECT_KEYS.detail.workflow.states.add.nameKey),
  );

  protected readonly categoryPickerConfig = computed<ErpInputPickerConfig>(() =>
    ErpInputPickerBuilder.create((b) =>
      b
        .setLabel(PROJECT_KEYS.detail.workflow.states.add.category)
        .setItems([
          { value: WORKFLOW_STATE_CATEGORY.Todo, label: this._t(PROJECT_KEYS.detail.workflow.states.category.todo) },
          {
            value: WORKFLOW_STATE_CATEGORY.InProgress,
            label: this._t(PROJECT_KEYS.detail.workflow.states.category.inProgress),
          },
          { value: WORKFLOW_STATE_CATEGORY.Done, label: this._t(PROJECT_KEYS.detail.workflow.states.category.done) },
        ])
        .setLabelKey('label')
        .setValueKey('value')
        .setStrategy('single'),
    ),
  );

  protected addStateButton(scheme: WorkflowSchemeDto): ErpButtonConfig {
    return {
      label: PROJECT_KEYS.detail.workflow.states.add.submit,
      appearance: 'primary',
      size: 'm',
      loading: this._saving,
      fn: () => this._addStateAsync(scheme),
    };
  }

  protected removeStateButton(scheme: WorkflowSchemeDto, state: WorkflowStateDto): ErpButtonConfig {
    return {
      label: PROJECT_KEYS.detail.workflow.states.remove.label,
      appearance: 'flat',
      size: 's',
      fn: () => this._removeStateAsync(scheme, state),
    };
  }

  protected categoryKey(category: number): string {
    switch (category) {
      case WORKFLOW_STATE_CATEGORY.InProgress:
        return PROJECT_KEYS.detail.workflow.states.category.inProgress;
      case WORKFLOW_STATE_CATEGORY.Done:
        return PROJECT_KEYS.detail.workflow.states.category.done;
      default:
        return PROJECT_KEYS.detail.workflow.states.category.todo;
    }
  }

  // ── Macierz przejść ──

  protected readonly selectedCell = signal<MatrixCell | null>(null);

  protected readonly transitionNameKeyControl = new FormControl<string | null>(null);
  protected readonly transitionPermissionControl = new FormControl<string | null>(null);
  protected readonly transitionFieldsControl = new FormControl<string | null>(null);

  protected readonly transitionNameKeyInput: ErpInputConfig = ErpInputBuilder.create((b) =>
    b.setLabel(PROJECT_KEYS.detail.workflow.transitions.form.nameKey),
  );

  protected readonly transitionPermissionInput: ErpInputConfig = ErpInputBuilder.create((b) =>
    b
      .setLabel(PROJECT_KEYS.detail.workflow.transitions.form.requiredPermission)
      .setHint(PROJECT_KEYS.detail.workflow.transitions.form.requiredPermissionHint),
  );

  protected readonly transitionFieldsInput: ErpInputConfig = ErpInputBuilder.create((b) =>
    b
      .setLabel(PROJECT_KEYS.detail.workflow.transitions.form.requiredFields)
      .setHint(PROJECT_KEYS.detail.workflow.transitions.form.requiredFieldsHint),
  );

  protected readonly cancelCellButton: ErpButtonConfig = {
    label: PROJECT_KEYS.detail.workflow.transitions.form.cancel,
    appearance: 'flat',
    size: 's',
    fn: () => this.selectedCell.set(null),
  };

  protected cellTransition(fromState: WorkflowStateDto, toState: WorkflowStateDto): WorkflowTransitionDto | undefined {
    return this.transitions().find((t) => t.fromStateUuid === fromState.uuid && t.toStateUuid === toState.uuid);
  }

  protected transitionCellConfig(
    fromState: WorkflowStateDto,
    toState: WorkflowStateDto,
  ): ErpWorkflowTransitionCellConfig {
    const transition = this.cellTransition(fromState, toState);
    return {
      transitionNameKey: transition?.nameKey,
      requiredPermission: Boolean(transition?.requiredPermission),
      requiredFieldsCount: transition?.requiredFields.length ?? 0,
      addLabelKey: PROJECT_KEYS.detail.workflow.transitions.cellAdd,
      permissionBadgeKey: PROJECT_KEYS.detail.workflow.transitions.cellPermissionBadge,
      fieldsBadgeKey: PROJECT_KEYS.detail.workflow.transitions.cellFieldsBadge,
      onSelect: () => this.selectCell(fromState, toState),
    };
  }

  protected selectCell(fromState: WorkflowStateDto, toState: WorkflowStateDto): void {
    const transition = this.cellTransition(fromState, toState);

    this.transitionNameKeyControl.setValue(transition?.nameKey ?? null);
    this.transitionPermissionControl.setValue(transition?.requiredPermission ?? null);
    this.transitionFieldsControl.setValue(transition?.requiredFields?.join(', ') ?? null);

    this.selectedCell.set({ fromState, toState, transition });
  }

  protected saveTransitionButton(scheme: WorkflowSchemeDto, cell: MatrixCell): ErpButtonConfig {
    return {
      label: PROJECT_KEYS.detail.workflow.transitions.form.submit,
      appearance: 'primary',
      size: 's',
      loading: this._saving,
      fn: () => this._saveTransitionAsync(scheme, cell),
    };
  }

  protected removeTransitionButton(scheme: WorkflowSchemeDto, transition: WorkflowTransitionDto): ErpButtonConfig {
    return {
      label: PROJECT_KEYS.detail.workflow.transitions.form.remove,
      appearance: 'flat',
      size: 's',
      fn: () => this._removeTransitionAsync(scheme, transition),
    };
  }

  /** Adapter granicy feature → ui dla `erp-workflow-editor`: DTO i orkiestracja zostają tutaj. */
  protected editorConfig(scheme: WorkflowSchemeDto): ErpWorkflowEditorConfig {
    const cell = this.selectedCell();

    return {
      title: PROJECT_KEYS.detail.workflow.transitions.title,
      matrixHint: PROJECT_KEYS.detail.workflow.transitions.matrixHint,
      emptyLabel: PROJECT_KEYS.detail.workflow.transitions.empty,
      states: this.states(),
      getCellConfig: (fromState, toState) =>
        this.transitionCellConfig(fromState as WorkflowStateDto, toState as WorkflowStateDto),
      selectedCell: cell
        ? { fromStateCode: cell.fromState.code, toStateCode: cell.toState.code, hasExistingTransition: !!cell.transition }
        : null,
      formTitle: (selected: ErpWorkflowEditorSelectedCell) => ({
        key: PROJECT_KEYS.detail.workflow.transitions.form.title,
        params: { from: selected.fromStateCode, to: selected.toStateCode },
      }),
      nameKeyControl: this.transitionNameKeyControl,
      nameKeyInputConfig: this.transitionNameKeyInput,
      permissionControl: this.transitionPermissionControl,
      permissionInputConfig: this.transitionPermissionInput,
      fieldsControl: this.transitionFieldsControl,
      fieldsInputConfig: this.transitionFieldsInput,
      removeButton: cell?.transition ? this.removeTransitionButton(scheme, cell.transition) : undefined,
      cancelButton: this.cancelCellButton,
      saveButton: cell ? this.saveTransitionButton(scheme, cell) : this.cancelCellButton,
    };
  }

  public constructor() {
    effect(() => {
      const uuid = this.project().workflowSchemeUuid;

      untracked(() => {
        if (uuid) {
          void this._loadSchemeAsync(uuid);
        }
      });
    });
  }

  /** Wołane z konstruktora oraz z przycisku „Ponów" — ten sam przebieg, żeby ponowienie nie było
   * osobną, gorzej utrzymaną kopią wczytywania. */
  protected async _loadSchemeAsync(uuid: string): Promise<void> {
    this.loadingScheme.set(true);
    this.schemeLoadError.set(false);

    try {
      await this._schemes.loadAsync([uuid], {});
    } catch (error) {
      console.error('[ProjectWorkflowSchemeComponent] Nie udało się wczytać schematu workflow.', error);
      this.schemeLoadError.set(true);
    } finally {
      this.loadingScheme.set(false);
    }
  }

  protected retrySchemeLoad(): void {
    const uuid = this.project().workflowSchemeUuid;

    if (uuid) {
      void this._loadSchemeAsync(uuid);
    }
  }

  private _t(key: string): string {
    return this._transloco.translate(key);
  }

  private async _addStateAsync(scheme: WorkflowSchemeDto): Promise<void> {
    const code = this.stateCodeControl.value?.trim();
    const nameKey = this.stateNameKeyControl.value?.trim();

    if (!code || !nameKey) {
      return;
    }

    this._saving.set(true);

    try {
      await this._schemes.addStateAsync({
        uuid: scheme.uuid,
        stateUuid: crypto.randomUUID(),
        code,
        nameKey,
        category: this.stateCategoryControl.value ?? WORKFLOW_STATE_CATEGORY.Todo,
        orderNo: this.states().length,
      });

      this.stateCodeControl.reset();
      this.stateNameKeyControl.reset();
      this.stateCategoryControl.setValue(WORKFLOW_STATE_CATEGORY.Todo);
    } catch (error) {
      console.error('[ProjectWorkflowSchemeComponent] Nie udało się dodać stanu.', error);
    } finally {
      this._saving.set(false);
    }
  }

  /** Stan bez otwartych zgłoszeń usuwa się wprost. Stan z otwartymi zgłoszeniami pivotuje do
   * modalu publikacji z mapowaniem (WF-006) — podgląd mówi, który to przypadek. */
  private async _removeStateAsync(scheme: WorkflowSchemeDto, state: WorkflowStateDto): Promise<void> {
    try {
      const preview = await this._schemes.getPublishPreviewAsync({ schemeUuid: scheme.uuid, statesToRemove: [state.uuid] });
      const candidate = preview.statesToRemove.find((s) => s.stateUuid === state.uuid);
      const issueCount = candidate?.issueCount ?? 0;

      if (issueCount === 0) {
        await this._confirm.confirmThenAsync(
          {
            title: PROJECT_KEYS.detail.workflow.publish.confirmRemoveTitle,
            message: PROJECT_KEYS.detail.workflow.publish.confirmRemoveMessage,
            details: [state.code],
          },
          async () => {
            await this._schemes.removeStateAsync({ uuid: scheme.uuid, stateUuid: state.uuid });
          },
        );
        return;
      }

      const metadata: WorkflowSchemePublishMetadata = { preview };
      this._modalService.open(
        WORKFLOW_SCHEME_PUBLISH_MODAL_ID,
        { uuid: scheme.uuid, statesToRemove: [state.uuid], mapping: {} },
        metadata,
      );
    } catch (error) {
      console.error('[ProjectWorkflowSchemeComponent] Nie udało się pobrać podglądu publikacji.', error);
    }
  }

  private async _saveTransitionAsync(scheme: WorkflowSchemeDto, cell: MatrixCell): Promise<void> {
    const nameKey = this.transitionNameKeyControl.value?.trim();

    if (!nameKey) {
      return;
    }

    const requiredFields = (this.transitionFieldsControl.value ?? '')
      .split(',')
      .map((code) => code.trim())
      .filter((code) => code.length > 0);

    this._saving.set(true);

    try {
      if (cell.transition) {
        await this._schemes.setTransitionAsync({
          uuid: scheme.uuid,
          transitionUuid: cell.transition.uuid,
          nameKey,
          requiredPermission: this.transitionPermissionControl.value?.trim() || undefined,
          requiredFields,
        });
      } else {
        await this._schemes.addTransitionAsync({
          uuid: scheme.uuid,
          transitionUuid: crypto.randomUUID(),
          fromStateUuid: cell.fromState.uuid,
          toStateUuid: cell.toState.uuid,
          nameKey,
          requiredPermission: this.transitionPermissionControl.value?.trim() || undefined,
          requiredFields,
        });
      }

      this.selectedCell.set(null);
    } catch (error) {
      console.error('[ProjectWorkflowSchemeComponent] Nie udało się zapisać przejścia.', error);
    } finally {
      this._saving.set(false);
    }
  }

  private async _removeTransitionAsync(scheme: WorkflowSchemeDto, transition: WorkflowTransitionDto): Promise<void> {
    this._saving.set(true);

    try {
      await this._schemes.removeTransitionAsync({ uuid: scheme.uuid, transitionUuid: transition.uuid });
      this.selectedCell.set(null);
    } catch (error) {
      console.error('[ProjectWorkflowSchemeComponent] Nie udało się usunąć przejścia.', error);
    } finally {
      this._saving.set(false);
    }
  }
}
