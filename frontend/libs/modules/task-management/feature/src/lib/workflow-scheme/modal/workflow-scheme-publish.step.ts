import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ErpInputPickerBuilder, ErpInputPickerComponent, ErpModalStepBase } from '@erp/shared/ui';
import { WorkflowSchemeExecPublishCommand } from '@erp/task-management/data-access';
import { WORKFLOW_KEYS } from '../translation';
import { WorkflowSchemePublishMetadata } from './workflow-scheme-publish.definition';

@Component({
  selector: 'erp-task-management-workflow-scheme-publish-step',
  standalone: true,
  imports: [ErpInputPickerComponent, ReactiveFormsModule],
  template: `<div class="flex flex-col gap-3">
    @for (state of metadata()().removedStates; track state.uuid) {
      <erp-input-picker
        [config]="config"
        [control]="control(state.uuid!)"
      />
    }
  </div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowSchemePublishStepComponent extends ErpModalStepBase<WorkflowSchemeExecPublishCommand, WorkflowSchemePublishMetadata> {
  private readonly _controls = new Map<string, FormControl<string | null>>();
  private readonly _valid = signal(false);
  protected readonly config = ErpInputPickerBuilder.create((b) =>
    b
      .setLabel(WORKFLOW_KEYS.mapping)
      .setItems(computed(() => this.command()().states?.map((state) => ({ value: state.uuid, label: state.code })) ?? []))
      .setLabelKey('label')
      .setValueKey('value')
      .setStrategy('single'),
  );

  public constructor() {
    super();
  }

  public ngOnInit(): void {
    for (const state of this.metadata()().removedStates) {
      if (state.uuid) this.control(state.uuid);
    }
    this._updateValidity();
    this.registerCanGoNext()?.(computed(() => this._valid()));
  }

  protected control(uuid: string): FormControl<string | null> {
    const existing = this._controls.get(uuid);
    if (existing) return existing;
    const control = new FormControl<string | null>(this.command()().removedStateMappings?.[uuid] ?? null, Validators.required);
    control.valueChanges.subscribe((value) => {
      this.command().update((command) => ({ ...command, removedStateMappings: { ...command.removedStateMappings, ...(value ? { [uuid]: value } : {}) } }));
      this._updateValidity();
    });
    this._controls.set(uuid, control);
    return control;
  }

  private _updateValidity(): void {
    this._valid.set([...this._controls.values()].every((control) => control.valid));
  }
}
