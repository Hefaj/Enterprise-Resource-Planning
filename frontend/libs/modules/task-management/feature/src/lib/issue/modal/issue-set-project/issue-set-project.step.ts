import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import {
  ErpBatchStepBase,
  ErpInputPickerBuilder,
  ErpInputPickerComponent,
  ErpInputPickerConfig,
  ErpTranslatePipe,
} from '@erp/shared/ui';
import {
  BatchCommandOfIssueSetProjectCommandAndSearchIssueRequest,
  TaskManagementIssueOrchestrator,
  TaskManagementProjectOrchestrator,
} from '@erp/task-management/data-access';

import { ISSUE_KEYS } from '../../translation';

interface UnmatchedFieldRow {
  readonly code: string;
  readonly control: FormControl<string | null>;
}

/**
 * Krok modalu seryjnego przeniesienia projektu: picker projektu docelowego + ekran decyzji
 * o polach niestandardowych bez odpowiednika (ISS-010 AC4).
 *
 * <p>Własny szablon, nie <c>ErpStepContentBuilder</c> — z tego samego powodu, co
 * <c>WorkflowRequiredFieldsStepComponent</c>: wiersze ekranu decyzji zależą od podglądu
 * pobranego z backendu PO wyborze projektu, więc nie da się ich opisać w konfiguracji
 * budowanej raz, w konstruktorze.</p>
 */
@Component({
  selector: 'erp-task-management-issue-set-project-step',
  standalone: true,
  imports: [ErpInputPickerComponent, ErpTranslatePipe, ReactiveFormsModule],
  template: `
    <div class="flex flex-col gap-3">
      <erp-input-picker [config]="projectPickerConfig()" [control]="projectControl" />

      @if (projectControl.value) {
        @if (unmatchedFields().length > 0) {
          <p class="m-0 text-sm text-[var(--tui-text-secondary)]">
            {{ ISSUE_KEYS.commands.setProject.unmatchedFieldsHint | erpTranslate }}
          </p>

          @for (row of unmatchedFields(); track row.code) {
            <div class="flex items-center gap-2">
              <span class="min-w-32 text-sm">{{ row.code }}</span>
              <erp-input-picker class="flex-1" [config]="targetFieldPickerConfig()" [control]="row.control" />
            </div>
          }
        } @else if (previewLoaded()) {
          <p class="m-0 text-sm text-[var(--tui-text-secondary)]">
            {{ ISSUE_KEYS.commands.setProject.noUnmatchedFields | erpTranslate }}
          </p>
        }
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueSetProjectStepComponent extends ErpBatchStepBase<BatchCommandOfIssueSetProjectCommandAndSearchIssueRequest> {
  protected readonly ISSUE_KEYS = ISSUE_KEYS;

  protected readonly projectControl = new FormControl<string | null>(null);

  protected readonly unmatchedFields = signal<UnmatchedFieldRow[]>([]);

  protected readonly previewLoaded = signal<boolean>(false);

  protected readonly targetFieldPickerConfig = signal<ErpInputPickerConfig>(
    ErpInputPickerBuilder.create((b) =>
      b
        .setLabel(ISSUE_KEYS.commands.setProject.unmatchedFieldTargetPlaceholder)
        .setItems([])
        .setLabelKey('name')
        .setValueKey('code')
        .setStrategy('single'),
    ),
  );

  protected readonly projectPickerConfig: ReturnType<typeof computed<ErpInputPickerConfig>>;

  private readonly _valid = signal<boolean>(false);

  public constructor() {
    super();

    const issues = inject(TaskManagementIssueOrchestrator);
    const projects = inject(TaskManagementProjectOrchestrator);

    this.projectPickerConfig = computed(() =>
      ErpInputPickerBuilder.create((b) =>
        b
          .setLabel(ISSUE_KEYS.commands.setProject.projectLabel)
          .setItems(
            [...projects.getViewModel()().values()].map((project) => ({
              uuid: project.uuid,
              label: `${project.code} — ${project.name}`,
            })),
          )
          .setLabelKey('label')
          .setValueKey('uuid')
          .setStrategy('single'),
      ),
    );

    // `this.command()` jest sygnałem dostępnym dopiero PO konstrukcji (wymagany input) —
    // odczyt wprost w konstruktorze rzuca `NG0950`. Wartość startowa idzie więc przez `effect`,
    // uruchamiany raz po zamontowaniu inputu, tak samo jak przy `WorkflowRequiredFieldsStepComponent`.
    //
    // `FormControl.value` NIE jest sygnałem — `effect()` obserwujący je bezpośrednio
    // uruchomiłby się RAZ, przy montowaniu, i nigdy więcej, mimo że użytkownik zmienia wybór
    // (tak wyglądał błąd znaleziony w tej weryfikacji: podgląd pól nigdy się nie odświeżał).
    // Odświeżanie podglądu idzie więc z `valueChanges`, nie z `effect`.
    effect(() => {
      const initial = this.command()().templateCommand?.targetProjectUuid ?? null;
      untracked(() => {
        if (initial && this.projectControl.value !== initial) {
          this.projectControl.setValue(initial);
        }
      });
    });

    this.projectControl.valueChanges.subscribe((value) => {
      this.command().update((cmd) => ({
        ...cmd,
        templateCommand: { targetProjectUuid: value ?? undefined, fieldDecisions: {} },
      }));

      if (!value) {
        this.unmatchedFields.set([]);
        this.previewLoaded.set(false);
      } else {
        void this._loadPreviewAsync(issues, value, this.targetUuids());
      }

      this._recomputeValid();
    });

    effect(() => {
      const register = this.registerCanGoNext();
      if (register) {
        register(this._valid.asReadonly());
      }
    });
  }

  private async _loadPreviewAsync(
    issues: TaskManagementIssueOrchestrator,
    targetProjectUuid: string,
    issueUuids: string[],
  ): Promise<void> {
    try {
      const preview = await issues.previewSetProjectAsync({ issueUuids, targetProjectUuid });

      this.targetFieldPickerConfig.set(
        ErpInputPickerBuilder.create((b) =>
          b
            .setLabel(ISSUE_KEYS.commands.setProject.unmatchedFieldTargetPlaceholder)
            .setItems(preview.targetFieldOptions ?? [])
            .setLabelKey('name')
            .setValueKey('code')
            .setStrategy('single'),
        ),
      );

      this.unmatchedFields.set(
        (preview.unmatchedFieldCodes ?? []).map((code) => this._toRow(code)),
      );
      this.previewLoaded.set(true);
      this._recomputeValid();
    } catch (error) {
      console.error('[IssueSetProjectStepComponent] Nie udało się pobrać podglądu przeniesienia.', error);
    }
  }

  private _toRow(code: string): UnmatchedFieldRow {
    const control = new FormControl<string | null>(null);

    control.valueChanges.subscribe((targetCode) => {
      this.command().update((cmd) => {
        const fieldDecisions = { ...cmd.templateCommand?.fieldDecisions };

        // Brak wyboru = odrzucenie wartości (ISS-010 AC4 domyślnie) — kontrakt niesie tylko
        // decyzje o PRZENIESIENIU, więc kod bez wybranego celu po prostu nie ma tu wpisu.
        if (targetCode) {
          fieldDecisions[code] = targetCode;
        } else {
          delete fieldDecisions[code];
        }

        return { ...cmd, templateCommand: { ...cmd.templateCommand, fieldDecisions } };
      });
    });

    return { code, control };
  }

  private _recomputeValid(): void {
    const hasTargets = this.isFilterMode() || this.targetUuids().length > 0;
    this._valid.set(hasTargets && !!this.projectControl.value);
  }
}
