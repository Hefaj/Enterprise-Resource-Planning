import { Injectable, inject } from '@angular/core';
import { ErpBatchMetadata, ErpModalBuilder, ErpModalConfig, ErpModalDefinition } from '@erp/shared/ui';
import {
  BatchCommandOfIssueAddTagCommandAndSearchIssueRequest,
  TaskManagementIssueOrchestrator,
} from '@erp/task-management/data-access';
import { ISSUE_ADD_TAG_MODAL_ID } from '@erp/task-management/util';

import { IssueAddTagStepComponent } from './issue-add-tag.step';
import { ISSUE_KEYS } from '../../translation';
import { IssueSetStateMetadata } from '../issue-set-state/issue-set-state.definition';

/**
 * Modal: seryjne dopięcie tagu (BULK-002). Metadata wzorem {@link IssueSetStateMetadata} —
 * projekt zawęża listę tagów do wyboru, tak samo jak przy stanie.
 */
@Injectable({ providedIn: 'root' })
export class IssueAddTagModalDefinition
  implements ErpModalDefinition<BatchCommandOfIssueAddTagCommandAndSearchIssueRequest, IssueSetStateMetadata>
{
  public readonly id = ISSUE_ADD_TAG_MODAL_ID;

  private readonly _issues = inject(TaskManagementIssueOrchestrator);

  public build(
    command: BatchCommandOfIssueAddTagCommandAndSearchIssueRequest,
    metadata?: ErpBatchMetadata & IssueSetStateMetadata,
  ): ErpModalConfig<BatchCommandOfIssueAddTagCommandAndSearchIssueRequest, IssueSetStateMetadata> {
    if (command.targetUuids?.length) {
      this._issues
        .loadAsync(command.targetUuids, {})
        .catch((err: unknown) => console.error('[IssueAddTagModalDefinition] Nie udało się pobrać zgłoszeń.', err));
    }

    return ErpModalBuilder.modal<BatchCommandOfIssueAddTagCommandAndSearchIssueRequest, IssueSetStateMetadata>((b) =>
      b
        .setTitle([ISSUE_KEYS.title, ISSUE_KEYS.commands.addTag.modalTitle])
        .setCommand(command)
        .setMetadata(metadata)
        .addStep(ISSUE_KEYS.commands.addTag.label, IssueAddTagStepComponent)
        .setSaveLabel(ISSUE_KEYS.commands.addTag.submitButton)
        .setOnSave(async (cmd) => {
          await this._issues.addTagMultipleAsync(cmd, ISSUE_ADD_TAG_MODAL_ID);
        }),
    );
  }
}
