import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ErpBatchStepBase, ErpInputBuilder, ErpInputComponent, ErpInputConfig, ErpInputPickerBuilder, ErpInputPickerComponent, ErpInputPickerConfig } from '@erp/shared/ui';
import { ERP_USER_DIRECTORY } from '@erp/shared/util';
import { BatchCommandOfIssueSetStateCommandAndSearchIssueRequest, ProjectFieldDto } from '@erp/task-management/data-access';
import { CUSTOM_FIELD_DATA_TYPE } from '@erp/task-management/util';
import { IssueSetStateMetadata } from './issue-set-state.definition';
import { taskManagementUserPickerConfig } from '../../../user/task-management-user-picker';

interface FieldControl {
  field: ProjectFieldDto;
  control: FormControl<string | null>;
  inputConfig?: ErpInputConfig;
  pickerConfig?: ErpInputPickerConfig;
}

@Component({
  selector: 'erp-task-management-issue-set-state-fields-step',
  standalone: true,
  imports: [ErpInputComponent, ErpInputPickerComponent, ReactiveFormsModule],
  template: `<div class="flex flex-col gap-3">
    @for (item of controls(); track item.field.code) {
      @if (item.pickerConfig) {
        <erp-input-picker
          [config]="item.pickerConfig"
          [control]="item.control"
        />
      } @else if (item.inputConfig) {
        <erp-input
          [config]="item.inputConfig"
          [formControl]="item.control"
        />
      }
    }
  </div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueSetStateFieldsStepComponent extends ErpBatchStepBase<BatchCommandOfIssueSetStateCommandAndSearchIssueRequest, IssueSetStateMetadata> {
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _directory = inject(ERP_USER_DIRECTORY, { optional: true });
  private readonly _valid = signal(false);
  protected readonly controls = signal<FieldControl[]>([]);

  public constructor() {
    super();
  }

  public ngOnInit(): void {
    const controls = (this.metadata()()?.requiredFields ?? []).map((field) => {
      const control = new FormControl<string | null>(null, Validators.required);
      control.valueChanges.pipe(takeUntilDestroyed(this._destroyRef)).subscribe(() => {
        this._sync();
        this._valid.set(this.controls().every((item) => item.control.valid));
      });
      if (field.dataType === CUSTOM_FIELD_DATA_TYPE.User) {
        return { field, control, pickerConfig: taskManagementUserPickerConfig(this._directory, { label: field.nameKey }) };
      }
      if (field.dataType === CUSTOM_FIELD_DATA_TYPE.Select) {
        return {
          field,
          control,
          pickerConfig: ErpInputPickerBuilder.create((b) =>
            b
              .setLabel(field.nameKey)
              .setItems(field.options.map((value) => ({ value, label: value })))
              .setLabelKey('label')
              .setValueKey('value')
              .setStrategy('single'),
          ),
        };
      }
      return { field, control, inputConfig: ErpInputBuilder.create((b) => b.setLabel(field.nameKey)) };
    });
    this.controls.set(controls);
    this._valid.set(controls.every((item) => item.control.valid));
    this.registerCanGoNext()?.(computed(() => this._valid()));
  }
  private _sync(): void {
    const customFieldValues = Object.fromEntries(this.controls().map((item) => [item.field.code, item.control.value?.trim() ?? '']));
    this.command().update((command) => ({ ...command, templateCommand: { ...command.templateCommand, customFieldValues } }));
  }
}
