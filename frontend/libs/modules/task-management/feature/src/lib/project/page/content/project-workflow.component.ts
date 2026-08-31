import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ErpButtonBuilder, ErpButtonComponent, ErpButtonConfig, ErpInputPickerBuilder, ErpInputPickerComponent, ErpInputPickerConfig, ErpTranslatePipe } from '@erp/shared/ui';
import {
  IssueExecStateMigrationCommand,
  ProjectVM,
  TaskManagementClient,
  TaskManagementProjectOrchestrator,
  WorkflowSchemeDto,
  WorkflowSchemeListItemDto,
  WorkflowStateDto,
} from '@erp/task-management/data-access';

import { PROJECT_KEYS } from '../../translation';

/**
 * Zakładka „automat stanów" na karcie projektu (`docs/frontend/task-management-pages.md` §4.2).
 *
 * <p>Do fazy 7 schemat stanów dawało się ustawić wyłącznie przy zakładaniu projektu, więc edytor
 * schematów nie miał komu oddać swojej pracy. Ta zakładka domyka tę ścieżkę.</p>
 *
 * <p><b>Kolejność operacji jest tu istotna i celowa</b>: najpierw komenda przestawia projekt,
 * dopiero potem lecą zadania migrujące zgłoszenia. Zadanie migracyjne wybiera cele po
 * <c>projekt → schemat</c>, więc dopóki projekt wskazuje stary schemat, filtr po nowym nie
 * zwróciłby niczego. Identyczny układ ma publikacja schematu
 * (`docs/backend/task-management.md` §5.3).</p>
 */
@Component({
  selector: 'erp-task-management-project-workflow',
  standalone: true,
  imports: [ErpButtonComponent, ErpInputPickerComponent, ErpTranslatePipe, ReactiveFormsModule],
  template: `
    <section class="flex flex-col gap-4 rounded-md border border-[var(--tui-border-normal)] p-4">
      <div class="flex flex-col gap-1">
        <span class="text-sm font-medium">{{ PROJECT_KEYS.detail.workflow.title | erpTranslate }}</span>
        <span class="text-xs text-[var(--tui-text-tertiary)]">{{ PROJECT_KEYS.detail.workflow.hint | erpTranslate }}</span>
      </div>

      <div class="flex items-end gap-3">
        <erp-input-picker
          class="w-80"
          [config]="schemePickerConfig()"
          [control]="schemeControl"
        />
        <erp-button [config]="saveButton" />
      </div>

      @if (unmappedStates().length > 0) {
        <div class="flex flex-col gap-3 rounded-md bg-[var(--tui-background-neutral-1)] p-3">
          <span class="text-sm font-medium">{{ PROJECT_KEYS.detail.workflow.mapping.title | erpTranslate }}</span>
          <span class="text-xs text-[var(--tui-text-tertiary)]">{{ PROJECT_KEYS.detail.workflow.mapping.hint | erpTranslate }}</span>

          @for (state of unmappedStates(); track state.uuid) {
            <div class="flex items-center gap-3">
              <span class="w-40 font-mono text-xs">{{ state.code }}</span>
              <erp-input-picker
                class="w-72"
                [config]="targetStatePickerConfig()"
                [control]="mappingControl(state.uuid)"
              />
            </div>
          }
        </div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectWorkflowComponent {
  protected readonly PROJECT_KEYS = PROJECT_KEYS;

  private readonly _api = inject(TaskManagementClient);
  private readonly _projects = inject(TaskManagementProjectOrchestrator);

  private readonly _schemes = signal<readonly WorkflowSchemeListItemDto[]>([]);
  private readonly _target = signal<WorkflowSchemeDto | undefined>(undefined);
  private readonly _usedStateUuids = signal<readonly string[]>([]);
  private readonly _currentStates = signal<readonly WorkflowStateDto[]>([]);
  private readonly _mappings = new Map<string, FormControl<string | null>>();
  private readonly _mappingVersion = signal(0);
  private readonly _saving = signal(false);

  public readonly project = input.required<ProjectVM>();

  protected readonly schemeControl = new FormControl<string | null>(null);

  protected readonly schemePickerConfig = computed<ErpInputPickerConfig<WorkflowSchemeListItemDto, string>>(() =>
    ErpInputPickerBuilder.create<ErpInputPickerBuilder<WorkflowSchemeListItemDto, string>>((b) =>
      b
        .setLabel(PROJECT_KEYS.detail.workflow.scheme.label)
        .setPlaceholder(PROJECT_KEYS.detail.workflow.scheme.placeholder)
        .setItems(computed(() => [...this._schemes()]))
        .setLabelKey('schemeName')
        .setValueKey('schemeUuid')
        .setStrategy('single'),
    ),
  );

  protected readonly targetStatePickerConfig = computed<ErpInputPickerConfig<WorkflowStateDto, string>>(() =>
    ErpInputPickerBuilder.create<ErpInputPickerBuilder<WorkflowStateDto, string>>((b) =>
      b
        .setLabel(PROJECT_KEYS.detail.workflow.mapping.target)
        .setItems(computed(() => [...(this._target()?.states ?? [])]))
        .setLabelKey('code')
        .setValueKey('uuid')
        .setStrategy('single'),
    ),
  );

  /**
   * Stany zajęte przez zgłoszenia tego projektu, których wybrany schemat nie zna.
   *
   * <p>Stan o tym samym uuidzie w obu schematach mapowania nie potrzebuje — dwa projekty mogą
   * dzielić ten sam stan między schematami, a migracja takiego zgłoszenia byłaby pustą operacją.</p>
   */
  protected readonly unmappedStates = computed<readonly WorkflowStateDto[]>(() => {
    const target = this._target();
    if (!target || target.schemeUuid === this.project().workflowSchemeUuid) return [];

    const known = new Set((target.states ?? []).map((state) => state.uuid));
    const used = new Set(this._usedStateUuids());

    return this._currentStates().filter((state) => used.has(state.uuid) && !known.has(state.uuid));
  });

  protected readonly saveButton: ErpButtonConfig = ErpButtonBuilder.create((b) =>
    b
      .setLabel(PROJECT_KEYS.detail.workflow.save)
      .setAppearance('primary')
      .setLoading(this._saving)
      .setDisabled(computed(() => !this._canSave()))
      .setFn(() => this._saveAsync()),
  );

  public constructor() {
    void this._loadSchemesAsync();

    // Zmiana projektu (wejście na inną kartę) i zmiana wyboru w pickerze prowadzą do tego samego:
    // trzeba znać stany schematu docelowego i stany zajęte przez zgłoszenia.
    effect(() => {
      const project = this.project();
      untracked(() => {
        this.schemeControl.setValue(project.workflowSchemeUuid ?? null, { emitEvent: false });
        void this._loadContextAsync(project);
      });
    });

    this.schemeControl.valueChanges.subscribe((value) => {
      this._mappings.clear();
      this._mappingVersion.update((version) => version + 1);
      void this._loadTargetAsync(value);
    });
  }

  protected mappingControl(stateUuid: string): FormControl<string | null> {
    this._mappingVersion();
    const existing = this._mappings.get(stateUuid);
    if (existing) return existing;

    const control = new FormControl<string | null>(null);
    control.valueChanges.subscribe(() => this._mappingVersion.update((version) => version + 1));
    this._mappings.set(stateUuid, control);
    return control;
  }

  private _canSave(): boolean {
    this._mappingVersion();
    const selected = this.schemeControl.value;
    if (!selected || selected === this.project().workflowSchemeUuid) return false;

    return this.unmappedStates().every((state) => !!this._mappings.get(state.uuid)?.value);
  }

  private async _loadSchemesAsync(): Promise<void> {
    this._schemes.set(await firstValueFrom(this._api.getWorkflowSchemes()));
  }

  private async _loadContextAsync(project: ProjectVM): Promise<void> {
    const [workflow, usage] = await Promise.all([
      firstValueFrom(this._api.getProjectWorkflow({ projectUuid: project.uuid })),
      firstValueFrom(this._api.getProjectStateUsage({ projectUuid: project.uuid })),
    ]);

    this._currentStates.set(workflow.states ?? []);
    this._usedStateUuids.set(usage.usedStateUuids ?? []);
    this._target.set(undefined);
  }

  private async _loadTargetAsync(schemeUuid: string | null): Promise<void> {
    if (!schemeUuid || schemeUuid === this.project().workflowSchemeUuid) {
      this._target.set(undefined);
      return;
    }

    this._target.set(await firstValueFrom(this._api.getWorkflowScheme({ schemeUuid })));
  }

  private async _saveAsync(): Promise<void> {
    const schemeUuid = this.schemeControl.value;
    if (!schemeUuid) return;

    const mappings = Object.fromEntries(
      this.unmappedStates()
        .map((state) => [state.uuid, this._mappings.get(state.uuid)?.value] as const)
        .filter((entry): entry is readonly [string, string] => !!entry[1]),
    );

    this._saving.set(true);
    try {
      await this._projects.setWorkflowSchemeAsync({ uuid: this.project().uuid, workflowSchemeUuid: schemeUuid, stateMappings: mappings });

      // Dopiero teraz — filtr zadania migracyjnego idzie po `projekt → schemat`.
      for (const [fromStateUuid, toStateUuid] of Object.entries(mappings)) {
        await firstValueFrom(
          this._api.issueExecStateMigrationMultipleCommand({
            templateCommand: { schemeUuid, fromStateUuid, toStateUuid } as IssueExecStateMigrationCommand,
            targetFilter: { schemeUuid, fromStateUuid },
            queueId: 'taskmgmt.project.workflow',
          }),
        );
      }
    } catch (error) {
      console.error('[ProjectWorkflowComponent] Nie udało się zmienić schematu stanów projektu.', error);
    } finally {
      this._saving.set(false);
    }
  }
}
