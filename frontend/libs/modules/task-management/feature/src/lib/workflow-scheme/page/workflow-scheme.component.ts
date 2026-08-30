import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  ErpButtonBuilder,
  ErpButtonComponent,
  ErpButtonConfig,
  ErpInputBuilder,
  ErpInputComponent,
  ErpInputPickerBuilder,
  ErpInputPickerComponent,
  ErpInputPickerConfig,
  ErpModalService,
  ErpTranslatePipe,
} from '@erp/shared/ui';
import { TaskManagementClient, WorkflowSchemeDto, WorkflowStateDefinitionDto, WorkflowTransitionDefinitionDto } from '@erp/task-management/data-access';
import { WORKFLOW_KEYS, provideWorkflowTranslations } from '../translation';
import { WorkflowStateRowComponent } from '../components/workflow-state-row.component';
import { WorkflowTransitionRowComponent } from '../components/workflow-transition-row.component';
import { WorkflowSchemePublishMetadata } from '../modal/workflow-scheme-publish.definition';
import { WORKFLOW_SCHEME_PUBLISH_MODAL_ID } from '@erp/task-management/util';

@Component({
  selector: 'erp-task-management-workflow-scheme',
  standalone: true,
  imports: [ReactiveFormsModule, ErpButtonComponent, ErpInputComponent, ErpInputPickerComponent, ErpTranslatePipe, WorkflowStateRowComponent, WorkflowTransitionRowComponent],
  providers: [provideWorkflowTranslations()],
  template: ` <main class="flex h-full min-h-0 flex-col gap-4 overflow-auto p-6">
    <h1 class="m-0 text-2xl font-semibold">{{ WORKFLOW_KEYS.title | erpTranslate }}</h1>
    <erp-input-picker
      [config]="schemePickerConfig"
      [control]="selectedScheme"
    />
    <div class="flex max-w-lg gap-2">
      <erp-input
        [config]="newSchemeNameConfig"
        [formControl]="newSchemeName"
      /><erp-button [config]="createButton" />
    </div>
    @if (scheme(); as current) {
      @if (current.isSystem) {
        <p class="m-0 text-[var(--tui-text-secondary)]">{{ WORKFLOW_KEYS.system | erpTranslate }}</p>
      }
      <erp-input
        [config]="workflowNameConfig"
        [formControl]="workflowName"
      />
      <section class="flex flex-col gap-2">
        <h2>{{ WORKFLOW_KEYS.states | erpTranslate }}</h2>
        @for (state of states(); track state.uuid; let i = $index) {
          <erp-task-management-workflow-state-row
            [state]="state"
            [disabled]="current.isSystem"
            (changed)="replaceState(i, $event)"
            (removed)="removeState(i)"
          />
        }
        <erp-button [config]="addStateButton" />
        @for (removed of removedStates(); track removed.uuid) {
          @if (removed.uuid; as removedUuid) {
            <erp-input-picker
              [config]="mappingPickerConfig(removed.code ?? removedUuid)"
              [control]="mappingControl(removedUuid)"
            />
          }
        }
      </section>
      <section class="flex flex-col gap-2">
        <h2>{{ WORKFLOW_KEYS.transitions | erpTranslate }}</h2>
        @if (transitions().length === 0) {
          <p>{{ WORKFLOW_KEYS.emptyTransitions | erpTranslate }}</p>
        }
        @for (transition of transitions(); track transition.uuid; let i = $index) {
          <erp-task-management-workflow-transition-row
            [transition]="transition"
            [states]="states()"
            [disabled]="current.isSystem"
            (changed)="replaceTransition(i, $event)"
            (removed)="removeTransition(i)"
          />
        }
        <erp-button [config]="addTransitionButton" />
      </section>
      <erp-button [config]="publishButton" />
    }
  </main>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowSchemeComponent {
  protected readonly WORKFLOW_KEYS = WORKFLOW_KEYS;
  private readonly _api = inject(TaskManagementClient);
  private readonly _modals = inject(ErpModalService);
  private readonly _destroyRef = inject(DestroyRef);
  protected readonly schemes = signal<readonly { uuid: string; name: string; isSystem: boolean }[]>([]);
  protected readonly selectedUuid = signal('');
  protected readonly scheme = signal<WorkflowSchemeDto | null>(null);
  protected readonly states = signal<WorkflowStateDefinitionDto[]>([]);
  protected readonly originalStates = signal<WorkflowStateDefinitionDto[]>([]);
  protected readonly transitions = signal<WorkflowTransitionDefinitionDto[]>([]);
  protected readonly saving = signal(false);
  protected readonly selectedScheme = new FormControl<string | null>(null);
  protected readonly workflowName = new FormControl('', { nonNullable: true });
  protected readonly newSchemeName = new FormControl('', { nonNullable: true });
  protected mappings: Record<string, string> = {};
  private readonly _mappingControls = new Map<string, FormControl<string | null>>();
  private readonly _schemeItems = computed(() => this.schemes().map((item) => ({ value: item.uuid, label: item.name })));
  private readonly _stateItems = computed(() => this.states().map((state) => ({ value: state.uuid, label: state.code })));
  private readonly _isSystem = computed(() => this.scheme()?.isSystem ?? true);
  private readonly _publishLabel = computed(() => (this.saving() ? WORKFLOW_KEYS.saving : WORKFLOW_KEYS.publish));
  private readonly _publishDisabled = computed(() => this._isSystem() || this.saving());
  protected readonly schemePickerConfig = ErpInputPickerBuilder.create((b) =>
    b.setLabel(WORKFLOW_KEYS.scheme).setPlaceholder(WORKFLOW_KEYS.select).setItems(this._schemeItems).setLabelKey('label').setValueKey('value').setStrategy('single'),
  );
  protected readonly newSchemeNameConfig = ErpInputBuilder.create((b) => b.setLabel(WORKFLOW_KEYS.newName));
  protected readonly workflowNameConfig = ErpInputBuilder.create((b) => b.setLabel(WORKFLOW_KEYS.name).setDisabled(this._isSystem));
  protected readonly createButton: ErpButtonConfig = ErpButtonBuilder.create((b) =>
    b
      .setLabel(WORKFLOW_KEYS.create)
      .setAppearance('outline')
      .setFn(() => this.createAsync()),
  );
  protected readonly addStateButton: ErpButtonConfig = ErpButtonBuilder.create((b) =>
    b
      .setLabel(WORKFLOW_KEYS.addState)
      .setAppearance('outline')
      .setDisabled(this._isSystem)
      .setFn(() => this.addState()),
  );
  protected readonly addTransitionButton: ErpButtonConfig = ErpButtonBuilder.create((b) =>
    b
      .setLabel(WORKFLOW_KEYS.addTransition)
      .setAppearance('outline')
      .setDisabled(this._isSystem)
      .setFn(() => this.addTransition()),
  );
  protected readonly publishButton: ErpButtonConfig = ErpButtonBuilder.create((b) =>
    b
      .setLabel(this._publishLabel)
      .setAppearance('primary')
      .setLoading(this.saving)
      .setDisabled(this._publishDisabled)
      .setFn(() => this.publishAsync()),
  );
  protected readonly removedStates = (): WorkflowStateDefinitionDto[] => this.originalStates().filter((x) => !this.states().some((state) => state.uuid === x.uuid));
  public ngOnInit(): void {
    void this._initAsync();
    this.selectedScheme.valueChanges.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((uuid) => void this.loadAsync(uuid ?? ''));
  }
  private async _initAsync(): Promise<void> {
    this.schemes.set(await firstValueFrom(this._api.getWorkflowSchemes()));
  }
  protected async createAsync(): Promise<void> {
    const name = this.newSchemeName.value.trim();
    if (!name) return;
    const uuid = await firstValueFrom(this._api.workflowSchemeCreateCommand({ name }));
    this.newSchemeName.setValue('');
    await this._initAsync();
    await this.loadAsync(uuid);
  }
  protected async loadAsync(uuid: string): Promise<void> {
    this.selectedUuid.set(uuid);
    if (this.selectedScheme.value !== uuid) {
      this.selectedScheme.setValue(uuid || null, { emitEvent: false });
    }
    if (!uuid) {
      this.scheme.set(null);
      return;
    }
    const scheme = await firstValueFrom(this._api.getWorkflowScheme({ schemeUuid: uuid }));
    this.scheme.set(scheme);
    this.workflowName.setValue(scheme.schemeName);
    const states = scheme.states.map((x) => ({ ...x }));
    this.states.set(states);
    this.originalStates.set(states.map((x) => ({ ...x })));
    this.transitions.set(scheme.transitions.map((x) => ({ ...x })));
    this.mappings = {};
    this._mappingControls.clear();
  }
  protected addState(): void {
    this.states.update((x) => [...x, { uuid: crypto.randomUUID(), code: '', nameKey: '', category: 0, orderNo: x.length }]);
  }
  protected removeState(index: number): void {
    this.states.update((x) => x.filter((_, i) => i !== index).map((state, i) => ({ ...state, orderNo: i })));
  }
  protected replaceState(index: number, state: WorkflowStateDefinitionDto): void {
    this.states.update((items) => items.map((item, itemIndex) => (itemIndex === index ? state : item)));
  }
  protected addTransition(): void {
    const first = this.states()[0]?.uuid;
    if (first) this.transitions.update((x) => [...x, { uuid: crypto.randomUUID(), fromStateUuid: first, toStateUuid: first, nameKey: '', requiredFieldCodes: [] }]);
  }
  protected removeTransition(index: number): void {
    this.transitions.update((x) => x.filter((_, i) => i !== index));
  }
  protected mappingPickerConfig(code: string): ErpInputPickerConfig {
    return ErpInputPickerBuilder.create((b) =>
      b.setLabel(`${WORKFLOW_KEYS.mapping}: ${code}`).setItems(this._stateItems).setLabelKey('label').setValueKey('value').setStrategy('single').setDisabled(this._isSystem),
    );
  }
  protected mappingControl(uuid: string): FormControl<string | null> {
    const existing = this._mappingControls.get(uuid);
    if (existing) return existing;
    const control = new FormControl<string | null>(this.mappings[uuid] ?? null);
    control.valueChanges.pipe(takeUntilDestroyed(this._destroyRef)).subscribe((value) => {
      if (value) this.mappings[uuid] = value;
      else delete this.mappings[uuid];
    });
    this._mappingControls.set(uuid, control);
    return control;
  }
  protected replaceTransition(index: number, transition: WorkflowTransitionDefinitionDto): void {
    this.transitions.update((items) => items.map((item, itemIndex) => (itemIndex === index ? transition : item)));
  }
  protected async publishAsync(): Promise<void> {
    const scheme = this.scheme();
    if (!scheme) return;
    this.saving.set(true);
    try {
      const modal = await this._modals.open(
        WORKFLOW_SCHEME_PUBLISH_MODAL_ID,
        { schemeUuid: scheme.schemeUuid, name: this.workflowName.value, states: this.states(), transitions: this.transitions(), removedStateMappings: this.mappings },
        { removedStates: this.removedStates() } satisfies WorkflowSchemePublishMetadata,
      );
      if (!(await modal.closed).saved) return;
      await this.loadAsync(scheme.schemeUuid);
    } finally {
      this.saving.set(false);
    }
  }
}
