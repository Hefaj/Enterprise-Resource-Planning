import { Injectable, inject } from '@angular/core';
import { ErpBatchMetadata, ErpModalBuilder, ErpModalConfig, ErpModalDefinition } from '@erp/shared/ui';
import {
  BatchCommandOfIssueRemoveTagCommandAndSearchIssueRequest,
  TaskManagementIssueOrchestrator,
} from '@erp/task-management/data-access';
import { ISSUE_REMOVE_TAG_MODAL_ID } from '@erp/task-management/util';

import { IssueRemoveTagStepComponent } from './issue-remove-tag.step';
import { ISSUE_KEYS } from '../../translation';
import { IssueSetStateMetadata } from '../issue-set-state/issue-set-state.definition';

/** Modal: seryjne odpięcie tagu (BULK-002) — patrz {@link IssueAddTagModalDefinition}, sam
 * kontekst projektu, odwrotna komenda. Odpięcie tagu, którego dane zgłoszenie nie ma, jest
 * no-opem (`Issue.RemoveTag` jest idempotentne), więc lista wyboru celowo nie jest zawężana
 * do przecięcia tagów zaznaczonych zgłoszeń. */
@Injectable({ providedIn: 'root' })
export class IssueRemoveTagModalDefinition
  implements ErpModalDefinition<BatchCommandOfIssueRemoveTagCommandAndSearchIssueRequest, IssueSetStateMetadata>
{
  public readonly id = ISSUE_REMOVE_TAG_MODAL_ID;

  private readonly _issues = inject(TaskManagementIssueOrchestrator);

  public build(
    command: BatchCommandOfIssueRemoveTagCommandAndSearchIssueRequest,
    metadata?: ErpBatchMetadata & IssueSetStateMetadata,
  ): ErpModalConfig<BatchCommandOfIssueRemoveTagCommandAndSearchIssueRequest, IssueSetStateMetadata> {
    if (command.targetUuids?.length) {
      this._issues
        .loadAsync(command.targetUuids, {})
        .catch((err: unknown) => console.error('[IssueRemoveTagModalDefinition] Nie udało się pobrać zgłoszeń.', err));
    }

    return ErpModalBuilder.modal<BatchCommandOfIssueRemoveTagCommandAndSearchIssueRequest, IssueSetStateMetadata>(
      (b) =>
        b
          .setTitle([ISSUE_KEYS.title, ISSUE_KEYS.commands.removeTag.modalTitle])
          .setCommand(command)
          .setMetadata(metadata)
          .addStep(ISSUE_KEYS.commands.removeTag.label, IssueRemoveTagStepComponent)
          .setSaveLabel(ISSUE_KEYS.commands.removeTag.submitButton)
          .setOnSave(async (cmd) => {
            await this._issues.removeTagMultipleAsync(cmd, ISSUE_REMOVE_TAG_MODAL_ID);
          }),
    );
  }
}
