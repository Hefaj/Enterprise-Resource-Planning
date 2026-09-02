import { Injectable, inject } from '@angular/core';
import { ErpBatchMetadata, ErpModalBuilder, ErpModalConfig, ErpModalDefinition } from '@erp/shared/ui';
import {
  BatchCommandOfIssueSetProjectCommandAndSearchIssueRequest,
  TaskManagementIssueOrchestrator,
  TaskManagementProjectOrchestrator,
} from '@erp/task-management/data-access';
import { ISSUE_SET_PROJECT_MODAL_ID } from '@erp/task-management/util';

import { IssueSetProjectStepComponent } from './issue-set-project.step';
import { ISSUE_KEYS } from '../../translation';

/**
 * Modal: seryjne przeniesienie zgłoszeń do innego projektu, razem z poddrzewem (ISS-010).
 *
 * <p>Nie potrzebuje kontekstu projektu ŹRÓDŁOWEGO — cele mogą leżeć w dowolnych projektach,
 * bo to właśnie projekt DOCELOWY jest tu jedyną decyzją. Ekran decyzji o polach bez odpowiednika
 * (AC4) dociąga się dopiero po wyborze projektu docelowego, wewnątrz kroku.</p>
 */
@Injectable({ providedIn: 'root' })
export class IssueSetProjectModalDefinition
  implements ErpModalDefinition<BatchCommandOfIssueSetProjectCommandAndSearchIssueRequest, ErpBatchMetadata>
{
  public readonly id = ISSUE_SET_PROJECT_MODAL_ID;

  private readonly _issues = inject(TaskManagementIssueOrchestrator);
  private readonly _projects = inject(TaskManagementProjectOrchestrator);

  public build(
    command: BatchCommandOfIssueSetProjectCommandAndSearchIssueRequest,
    metadata?: ErpBatchMetadata,
  ): ErpModalConfig<BatchCommandOfIssueSetProjectCommandAndSearchIssueRequest, ErpBatchMetadata> {
    if (command.targetUuids?.length) {
      this._issues
        .loadAsync(command.targetUuids, {})
        .catch((err: unknown) => console.error('[IssueSetProjectModalDefinition] Nie udało się pobrać zgłoszeń.', err));
    }

    // Projekty są nieliczne (dziesiątki) — pełna lista bez paginacji, tak samo jak w tworzeniu
    // zgłoszenia.
    this._projects
      .searchAsync({ page: 1, pageSize: 200 })
      .catch((err: unknown) => console.error('[IssueSetProjectModalDefinition] Nie udało się pobrać projektów.', err));

    return ErpModalBuilder.modal<BatchCommandOfIssueSetProjectCommandAndSearchIssueRequest, ErpBatchMetadata>((b) =>
      b
        .setTitle([ISSUE_KEYS.title, ISSUE_KEYS.commands.setProject.modalTitle])
        .setCommand(command)
        .setMetadata(metadata)
        .addStep(ISSUE_KEYS.commands.setProject.label, IssueSetProjectStepComponent)
        .setSaveLabel(ISSUE_KEYS.commands.setProject.submitButton)
        .setOnSave(async (cmd) => {
          await this._issues.setProjectMultipleAsync(cmd, ISSUE_SET_PROJECT_MODAL_ID);
        }),
    );
  }
}
