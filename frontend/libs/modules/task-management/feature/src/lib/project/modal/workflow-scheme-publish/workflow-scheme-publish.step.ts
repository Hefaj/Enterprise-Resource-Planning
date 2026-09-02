import { ChangeDetectionStrategy, Component, Signal, computed, effect } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import {
  ErpInputPickerBuilder,
  ErpInputPickerComponent,
  ErpInputPickerConfig,
  ErpModalStepBase,
  ErpTranslatePipe,
} from '@erp/shared/ui';
import { WorkflowSchemeExecPublishCommand } from '@erp/task-management/data-access';

import { WorkflowSchemePublishMetadata } from './workflow-scheme-publish.definition';
import { PROJECT_KEYS } from '../../translation';

interface MappingRow {
  readonly stateUuid: string;
  readonly code: string;
  readonly nameKey: string;
  readonly issueCount: number;
  readonly control: FormControl<string | null>;
}

/**
 * Ekran decyzji „dokąd migrują zgłoszenia" dla publikacji schematu (WF-006).
 *
 * <p>Wzorem `IssueSetProjectStepComponent`: własny szablon zamiast `ErpStepContentBuilder`, bo
 * liczba wierszy (jeden picker per usuwany stan) zależy od podglądu pobranego PRZED otwarciem
 * modalu (`GetWorkflowSchemePublishPreview`), a nie z konfiguracji budowanej raz w konstruktorze.
 * Mapping musi pokryć WSZYSTKIE usuwane stany (WF-006 AC2) — przycisk zapisu jest zablokowany,
 * dopóki każdy wiersz ma wybrany cel.</p>
 */
@Component({
  selector: 'erp-task-management-workflow-scheme-publish-step',
  standalone: true,
  imports: [ErpInputPickerComponent, ErpTranslatePipe, ReactiveFormsModule],
  template: `
    <div class="flex flex-col gap-3">
      <p class="m-0 text-sm text-[var(--tui-text-secondary)]">
        {{ PROJECT_KEYS.detail.workflow.publish.intro | erpTranslate }}
      </p>

      @for (row of rows(); track row.stateUuid) {
        <div class="flex items-center gap-3 rounded-md border border-[var(--tui-border-normal)] p-3">
          <div class="flex-1">
            <div class="text-sm font-medium">{{ row.nameKey | erpTranslate }}</div>
            <div class="text-xs text-[var(--tui-text-tertiary)]">
              {{ PROJECT_KEYS.detail.workflow.publish.stateIssueCount | erpTranslate: { count: row.issueCount } }}
            </div>
          </div>
          <erp-input-picker class="w-64" [config]="targetPickerConfig()" [control]="row.control" />
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowSchemePublishStepComponent extends ErpModalStepBase<
  WorkflowSchemeExecPublishCommand,
  WorkflowSchemePublishMetadata
> {
  protected readonly PROJECT_KEYS = PROJECT_KEYS;

  protected readonly rows: Signal<MappingRow[]>;

  protected readonly targetPickerConfig: Signal<ErpInputPickerConfig>;

  private readonly _valid = computed(() => this.rows().every((row) => !!row.control.value));

  public constructor() {
    super();

    this.targetPickerConfig = computed(() =>
      ErpInputPickerBuilder.create((b) =>
        b
          .setLabel(PROJECT_KEYS.detail.workflow.publish.targetLabel)
          .setPlaceholder(PROJECT_KEYS.detail.workflow.publish.targetPlaceholder)
          .setItems(
            (this.metadata()()?.preview.availableTargets ?? []).map((target) => ({
              value: target.stateUuid,
              label: target.code,
            })),
          )
          .setLabelKey('label')
          .setValueKey('value')
          .setStrategy('single'),
      ),
    );

    this.rows = computed(() => {
      const preview = this.metadata()()?.preview;
      const existingMapping = this.command()().mapping ?? {};

      return (preview?.statesToRemove ?? []).map((candidate) => {
        const control = new FormControl<string | null>(existingMapping[candidate.stateUuid] ?? null);

        control.valueChanges.subscribe((value) => {
          this.command().update((cmd) => {
            const mapping = { ...cmd.mapping };

            if (value) {
              mapping[candidate.stateUuid] = value;
            } else {
              delete mapping[candidate.stateUuid];
            }

            return { ...cmd, mapping };
          });
        });

        return {
          stateUuid: candidate.stateUuid,
          code: candidate.code,
          nameKey: candidate.nameKey,
          issueCount: candidate.issueCount,
          control,
        };
      });
    });

    effect(() => {
      const register = this.registerCanGoNext();
      if (register) {
        register(this._valid);
      }
    });
  }
}
