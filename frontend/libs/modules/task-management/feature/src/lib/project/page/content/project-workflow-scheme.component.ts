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

import { WorkflowSchemePublishMetadata } from '../../modal/workflow-scheme-publish/workflow-scheme-publish.definition';
import { PROJECT_KEYS } from '../../translation';

interface MatrixCell {
  readonly fromState: WorkflowStateDto;
  readonly toState: WorkflowStateDto;
  readonly transition: WorkflowTransitionDto | undefined;
}

/**
 * Zakładka schematu stanów na karcie projektu (`WF-006`/`WF-007`,
 * `docs/frontend/task-management-pages.md` §4.3).
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
    ErpTranslatePipe,
    ReactiveFormsModule,
  ],
  template: `
    <section class="flex flex-col gap-6">
      @let scheme = this.scheme();

      @if (!scheme) {
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
            <table class="w-full text-sm">
              <thead class="text-left text-xs uppercase text-[var(--tui-text-tertiary)]">
                <tr>
                  <th class="py-1">{{ PROJECT_KEYS.detail.workflow.states.columns.code | erpTranslate }}</th>
                  <th class="py-1">{{ PROJECT_KEYS.detail.workflow.states.columns.name | erpTranslate }}</th>
                  <th class="py-1">{{ PROJECT_KEYS.detail.workflow.states.columns.category | erpTranslate }}</th>
                  <th class="py-1"></th>
                </tr>
              </thead>
              <tbody>
                @for (state of this.states(); track state.uuid) {
                  <tr class="border-t border-[var(--tui-border-normal)]">
                    <td class="py-2 font-mono text-xs">{{ state.code }}</td>
                    <td class="py-2">{{ state.nameKey | erpTranslate }}</td>
                    <td class="py-2">{{ this.categoryKey(state.category) | erpTranslate }}</td>
                    <td class="py-2 text-right">
                      <erp-button [config]="this.removeStateButton(scheme, state)" />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }

          <div class="flex flex-col gap-3 rounded-md border border-[var(--tui-border-normal)] p-4">
            <span class="text-sm font-medium">{{ PROJECT_KEYS.detail.workflow.states.add.title | erpTranslate }}</span>

            <div class="grid grid-cols-3 gap-3">
              <erp-input [config]="this.stateCodeInput" [formControl]="this.stateCodeControl" />
              <erp-input [config]="this.stateNameKeyInput" [formControl]="this.stateNameKeyControl" />
              <erp-input-picker [config]="this.categoryPickerConfig()" [control]="this.stateCategoryControl" />
            </div>

            <div class="flex justify-end">
              <erp-button [config]="this.addStateButton(scheme)" />
            </div>
          </div>
        </div>

        <!-- Przejścia: macierz z → do -->
        <div class="flex flex-col gap-3">
          <span class="text-sm font-medium">{{ PROJECT_KEYS.detail.workflow.transitions.title | erpTranslate }}</span>
          <span class="text-xs text-[var(--tui-text-secondary)]">
            {{ PROJECT_KEYS.detail.workflow.transitions.matrixHint | erpTranslate }}
          </span>

          @if (this.states().length < 2) {
            <span class="text-sm text-[var(--tui-text-secondary)]">
              {{ PROJECT_KEYS.detail.workflow.transitions.empty | erpTranslate }}
            </span>
          } @else {
            <div class="overflow-x-auto">
              <table class="text-sm">
                <thead>
                  <tr>
                    <th class="p-2"></th>
                    @for (toState of this.states(); track toState.uuid) {
                      <th class="p-2 text-left text-xs uppercase text-[var(--tui-text-tertiary)]">
                        {{ toState.code }}
                      </th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (fromState of this.states(); track fromState.uuid) {
                    <tr class="border-t border-[var(--tui-border-normal)]">
                      <th class="p-2 text-left text-xs uppercase text-[var(--tui-text-tertiary)]">
                        {{ fromState.code }}
                      </th>
                      @for (toState of this.states(); track toState.uuid) {
                        <td class="p-2">
                          @if (fromState.uuid !== toState.uuid) {
                            <button
                              type="button"
                              class="min-w-24 rounded border border-[var(--tui-border-normal)] px-2 py-1 text-left text-xs hover:bg-[var(--tui-background-neutral-1)]"
                              (click)="this.selectCell(fromState, toState)"
                            >
                              @if (this.cellTransition(fromState, toState); as transition) {
                                <span class="block truncate">{{ transition.nameKey | erpTranslate }}</span>
                                <span class="flex gap-1 text-[10px] text-[var(--tui-text-tertiary)]">
                                  @if (transition.requiredPermission) {
                                    <span>🔒 {{ PROJECT_KEYS.detail.workflow.transitions.cellPermissionBadge | erpTranslate }}</span>
                                  }
                                  @if (transition.requiredFields.length > 0) {
                                    <span>📋 {{ PROJECT_KEYS.detail.workflow.transitions.cellFieldsBadge | erpTranslate }}</span>
                                  }
                                </span>
                              } @else {
                                <span class="text-[var(--tui-text-tertiary)]">
                                  {{ PROJECT_KEYS.detail.workflow.transitions.cellAdd | erpTranslate }}
                                </span>
                              }
                            </button>
                          }
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          @if (this.selectedCell(); as cell) {
            <div class="flex flex-col gap-3 rounded-md border border-[var(--tui-border-normal)] p-4">
              <span class="text-sm font-medium">
                {{
                  PROJECT_KEYS.detail.workflow.transitions.form.title
                    | erpTranslate: { from: cell.fromState.code, to: cell.toState.code }
                }}
              </span>

              <div class="grid grid-cols-2 gap-3">
                <erp-input [config]="this.transitionNameKeyInput" [formControl]="this.transitionNameKeyControl" />
                <erp-input [config]="this.transitionPermissionInput" [formControl]="this.transitionPermissionControl" />
                <erp-input [config]="this.transitionFieldsInput" [formControl]="this.transitionFieldsControl" />
              </div>

              <div class="flex justify-end gap-2">
                @if (cell.transition) {
                  <erp-button [config]="this.removeTransitionButton(scheme, cell.transition)" />
                }
                <erp-button [config]="this.cancelCellButton" />
                <erp-button [config]="this.saveTransitionButton(scheme, cell)" />
              </div>
            </div>
          }
        </div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectWorkflowSchemeComponent {
  protected readonly PROJECT_KEYS = PROJECT_KEYS;

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

  protected readonly states = computed<WorkflowStateDto[]>(() =>
    [...(this.scheme()?.states ?? [])].sort((a, b) => a.orderNo - b.orderNo),
  );

  protected readonly transitions = computed<WorkflowTransitionDto[]>(() => this.scheme()?.transitions ?? []);

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

  public constructor() {
    effect(() => {
      const uuid = this.project().workflowSchemeUuid;

      untracked(() => {
        if (uuid) {
          void this._schemes.loadAsync([uuid], {});
        }
      });
    });
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
