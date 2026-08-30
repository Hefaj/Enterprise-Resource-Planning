import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ErpButtonBuilder, ErpButtonComponent, ErpInputBuilder, ErpInputComponent, ErpInputPickerBuilder, ErpInputPickerComponent } from '@erp/shared/ui';
import { WorkflowStateDefinitionDto } from '@erp/task-management/data-access';
import { WORKFLOW_KEYS } from '../translation';

@Component({
  selector: 'erp-task-management-workflow-state-row',
  standalone: true,
  imports: [ErpButtonComponent, ErpInputComponent, ErpInputPickerComponent, ReactiveFormsModule],
  template: `<div class="grid grid-cols-[1fr_2fr_1fr_auto] gap-2">
    <erp-input
      [config]="codeConfig"
      [formControl]="code"
    />
    <erp-input
      [config]="nameKeyConfig"
      [formControl]="nameKey"
    />
    <erp-input-picker
      [config]="categoryConfig"
      [control]="category"
    />
    <erp-button [config]="removeConfig" />
  </div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowStateRowComponent {
  public readonly state = input.required<WorkflowStateDefinitionDto>();
  public readonly disabled = input(false);
  public readonly changed = output<WorkflowStateDefinitionDto>();
  public readonly removed = output<void>();
  protected readonly code = new FormControl('');
  protected readonly nameKey = new FormControl('');
  protected readonly category = new FormControl<number>(0, { nonNullable: true });
  protected readonly codeConfig = ErpInputBuilder.create((b) => b.setLabel(WORKFLOW_KEYS.code).setDisabled(this.disabled));
  protected readonly nameKeyConfig = ErpInputBuilder.create((b) => b.setLabel(WORKFLOW_KEYS.nameKey).setDisabled(this.disabled));
  protected readonly categoryConfig = ErpInputPickerBuilder.create((b) =>
    b
      .setLabel(WORKFLOW_KEYS.category)
      .setItems([
        { value: 0, label: WORKFLOW_KEYS.categories.todo },
        { value: 1, label: WORKFLOW_KEYS.categories.inProgress },
        { value: 2, label: WORKFLOW_KEYS.categories.done },
      ])
      .setLabelKey('label')
      .setValueKey('value')
      .setStrategy('single')
      .setDisabled(this.disabled),
  );
  protected readonly removeConfig = ErpButtonBuilder.create((b) =>
    b
      .setLabel(WORKFLOW_KEYS.remove)
      .setAppearance('destructive')
      .setDisabled(this.disabled)
      .setFn(() => this.removed.emit()),
  );
  public constructor() {
    effect(() => {
      const value = this.state();
      this.code.setValue(value.code ?? '', { emitEvent: false });
      this.nameKey.setValue(value.nameKey ?? '', { emitEvent: false });
      this.category.setValue(value.category ?? 0, { emitEvent: false });
    });
    this.code.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this._emit());
    this.nameKey.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this._emit());
    this.category.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this._emit());
  }

  private _emit(): void {
    this.changed.emit({ ...this.state(), code: this.code.value ?? '', nameKey: this.nameKey.value ?? '', category: this.category.value });
  }
}
