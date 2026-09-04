import { Injectable, inject } from '@angular/core';

import { JobService } from '@erp/shared/data-access';
import { ErpModalBuilder, ErpModalConfig, ErpModalDefinition } from '@erp/shared/ui';
import {
  IssueSetCustomFieldsCommand,
  ProjectFieldProfileService,
  TaskManagementIssueOrchestrator,
  erpAwaitJobAsync,
} from '@erp/task-management/data-access';
import { WORKFLOW_REQUIRED_FIELDS_MODAL_ID } from '@erp/task-management/util';

import { WorkflowRequiredFieldsStepComponent } from './workflow-required-fields.step';
import { ISSUE_KEYS } from '../../translation';

/**
 * Komenda tego modalu NIE jest kontraktem NSwag — WF-004 nie ma własnego endpointu, bo modal
 * tylko uzupełnia pola przed komendą, którą i tak wysyła wywołujący
 * (`BoardStore.dropAsync`/`IssueDetailComponent.applyTransitionAsync`). `values` startuje
 * z PEŁNĄ bieżącą mapą pól zgłoszenia — `IssueSetCustomFieldsCommand` nadpisuje ją w CAŁOŚCI
 * (`docs/guides/backend/endpoint-naming.md` §2), więc modal, który znałby tylko brakujące pola,
 * wyzerowałby przy zapisie wszystkie pozostałe.
 */
export interface WorkflowRequiredFieldsCommand {
  issueUuid: string;
  values: Record<string, string>;

  /** Rozwiązanie (ISS-007) — pole pierwszej klasy, więc jedzie OSOBNO od `values`
   * (`custom_fields`), mimo że kod pola w `RequiredFields` schematu to nadal `"resolution"`. */
  resolutionUuid?: string;
}

/** Kontekst potrzebny do zbudowania formularza: projekt (profil pól) i lista kodów, których
 * dziś brakuje na zgłoszeniu — `WorkflowTransitionDto.requiredFields` minus to, co już wypełnione
 * (`findMissingRequiredFieldCodes`, `@erp/task-management/data-access`). */
export interface WorkflowRequiredFieldsMetadata {
  projectUuid: string;
  missingFieldCodes: readonly string[];
}

/**
 * Modal WF-004: uzupełnienie pól wymaganych przez przejście, PRZED wysłaniem
 * `IssueSetStateCommand`. Zapisuje WYŁĄCZNIE pola niestandardowe — zmianę stanu wykonuje
 * wywołujący, dopiero po tym, jak ten modal się zamknie z `saved: true`
 * (`docs/modules/task-management/domain.md` §5.2, AC1: anulowanie modala nie rusza karty).
 */
@Injectable({ providedIn: 'root' })
export class WorkflowRequiredFieldsModalDefinition
  implements ErpModalDefinition<WorkflowRequiredFieldsCommand, WorkflowRequiredFieldsMetadata>
{
  public readonly id = WORKFLOW_REQUIRED_FIELDS_MODAL_ID;

  private readonly _issues = inject(TaskManagementIssueOrchestrator);
  private readonly _jobs = inject(JobService);
  private readonly _fields = inject(ProjectFieldProfileService);

  public build(
    command: WorkflowRequiredFieldsCommand,
    metadata?: WorkflowRequiredFieldsMetadata,
  ): ErpModalConfig<WorkflowRequiredFieldsCommand, WorkflowRequiredFieldsMetadata> {
    if (metadata?.projectUuid) {
      this._fields
        .loadAsync(metadata.projectUuid)
        .catch((err: unknown) =>
          console.error('[WorkflowRequiredFieldsModalDefinition] Nie udało się pobrać profilu pól.', err),
        );
    }

    return ErpModalBuilder.modal<WorkflowRequiredFieldsCommand, WorkflowRequiredFieldsMetadata>((b) =>
      b
        .setTitle([ISSUE_KEYS.title, ISSUE_KEYS.commands.requiredFields.modalTitle])
        .setCommand(command)
        .setMetadata(metadata)
        .addStep(ISSUE_KEYS.commands.requiredFields.label, WorkflowRequiredFieldsStepComponent)
        .setSaveLabel(ISSUE_KEYS.commands.requiredFields.submitButton)
        .setOnSave(async (cmd) => {
          const setCustomFields: IssueSetCustomFieldsCommand = { uuid: cmd.issueUuid, values: cmd.values };
          const jobUuid = await this._issues.setCustomFieldsAsync(setCustomFields, WORKFLOW_REQUIRED_FIELDS_MODAL_ID);

          // Karta wisi „w toku" na tablicy dopóki ten modal nie zamknie się — więc zanim
          // `setOnSave` się rozwiąże, pola muszą być NAPRAWDĘ zapisane, nie tylko przyjęte
          // do kolejki (`docs/modules/task-management/requirements.md` WF-004 AC1).
          await erpAwaitJobAsync(this._jobs, jobUuid);

          // Rozwiązanie jedzie OSOBNĄ komendą — pole pierwszej klasy, nie wpis w `values`.
          if (cmd.resolutionUuid) {
            const resolutionJobUuid = await this._issues.setResolutionAsync(
              { uuid: cmd.issueUuid, resolutionUuid: cmd.resolutionUuid },
              WORKFLOW_REQUIRED_FIELDS_MODAL_ID,
            );
            await erpAwaitJobAsync(this._jobs, resolutionJobUuid);
          }
        }),
    );
  }
}
