import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ErpButtonBuilder, ErpButtonComponent, ErpInputBuilder, ErpInputComponent, ErpInputPickerBuilder, ErpInputPickerComponent } from '@erp/shared/ui';
import { WorkflowStateDefinitionDto, WorkflowTransitionDefinitionDto } from '@erp/task-management/data-access';
import { WORKFLOW_KEYS } from '../translation';

@Component({
  selector: 'erp-task-management-workflow-transition-row',
  standalone: true,
  imports: [ErpButtonComponent, ErpInputComponent, ErpInputPickerComponent, ReactiveFormsModule],
  template: `<div class="grid grid-cols-[1fr_1fr_2fr_2fr_auto] gap-2">
    <erp-input-picker
      [config]="stateConfig"
      [control]="from"
    /><erp-input-picker
      [config]="stateConfig"
      [control]="to"
    /><erp-input
      [config]="nameConfig"
      [formControl]="nameKey"
    /><erp-input
      [config]="fieldsConfig"
      [formControl]="requiredFields"
    /><erp-button [config]="removeConfig" />
  </div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowTransitionRowComponent {
  private readonly _destroyRef = inject(DestroyRef);
  public readonly transition = input.required<WorkflowTransitionDefinitionDto>();
  public readonly states = input.required<readonly WorkflowStateDefinitionDto[]>();
  public readonly disabled = input(false);
  public readonly changed = output<WorkflowTransitionDefinitionDto>();
  public readonly removed = output<void>();
  protected readonly from = new FormControl<string | null>(null);
  protected readonly to = new FormControl<string | null>(null);
  protected readonly nameKey = new FormControl('');
  protected readonly requiredFields = new FormControl('');
  private readonly _stateItems = computed(() => this.states().map((state) => ({ value: state.uuid, label: state.code })));
  protected readonly stateConfig = ErpInputPickerBuilder.create((b) => b.setItems(this._stateItems).setLabelKey('label').setValueKey('value').setStrategy('single').setDisabled(this.disabled));
  protected readonly nameConfig = ErpInputBuilder.create((b) => b.setLabel(WORKFLOW_KEYS.nameKey).setDisabled(this.disabled));
  protected readonly fieldsConfig = ErpInputBuilder.create((b) => b.setLabel(WORKFLOW_KEYS.requiredFields).setPlaceholder(WORKFLOW_KEYS.requiredFieldsHint).setDisabled(this.disabled));
  protected readonly removeConfig = ErpButtonBuilder.create((b) =>
    b
      .setLabel(WORKFLOW_KEYS.remove)
      .setAppearance('destructive')
      .setDisabled(this.disabled)
      .setFn(() => this.removed.emit()),
  );
  public constructor() {
    effect(() => {
      const value = this.transition();
      this.from.setValue(value.fromStateUuid ?? null, { emitEvent: false });
      this.to.setValue(value.toStateUuid ?? null, { emitEvent: false });
      this.nameKey.setValue(value.nameKey ?? '', { emitEvent: false });
      this.requiredFields.setValue((value.requiredFieldCodes ?? []).join(', '), { emitEvent: false });
    });
    [this.from, this.to, this.nameKey, this.requiredFields].forEach((control) => control.valueChanges.pipe(takeUntilDestroyed(this._destroyRef)).subscribe(() => this._emit()));
  }
  private _emit(): void {
    const requiredFieldCodes = (this.requiredFields.value ?? '')
      .split(',')
      .map((code) => code.trim())
      .filter((code, index, codes) => !!code && codes.indexOf(code) === index);
    this.changed.emit({ ...this.transition(), fromStateUuid: this.from.value ?? undefined, toStateUuid: this.to.value ?? undefined, nameKey: this.nameKey.value ?? '', requiredFieldCodes });
  }
}
