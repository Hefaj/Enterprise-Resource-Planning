import { Injectable, inject } from '@angular/core';

import { ErpBatchMetadata, ErpModalBuilder, ErpModalConfig, ErpModalDefinition } from '@erp/shared/ui';
import {
  BatchCommandOfIssueSetAssigneeCommandAndSearchIssueRequest,
  TaskManagementIssueOrchestrator,
} from '@erp/task-management/data-access';
import { ISSUE_SET_ASSIGNEE_MODAL_ID } from '@erp/task-management/util';

import { IssueSetAssigneeStepComponent } from './issue-set-assignee.step';
import { ISSUE_KEYS } from '../../translation';

/**
 * Modal: seryjne przypisanie zgłoszeń.
 *
 * <p><b>Nie potrzebuje kontekstu projektu</b> — inaczej niż zmiana stanu. Stany są konfiguracją
 * projektu, więc tamten modal bez projektu nie ma z czego zbudować listy; ludzie są wspólni dla
 * całej firmy, więc ten działa także na zaznaczeniu z kilku projektów.</p>
 *
 * <p>Puste pole osoby to <b>zdjęcie przypisania</b>, nie brak decyzji — dlatego zapis jest
 * dozwolony również wtedy.</p>
 */
@Injectable({ providedIn: 'root' })
export class IssueSetAssigneeModalDefinition
  implements ErpModalDefinition<BatchCommandOfIssueSetAssigneeCommandAndSearchIssueRequest, ErpBatchMetadata>
{
  public readonly id = ISSUE_SET_ASSIGNEE_MODAL_ID;

  private readonly _issues = inject(TaskManagementIssueOrchestrator);

  public build(
    command: BatchCommandOfIssueSetAssigneeCommandAndSearchIssueRequest,
    metadata?: ErpBatchMetadata,
  ): ErpModalConfig<BatchCommandOfIssueSetAssigneeCommandAndSearchIssueRequest, ErpBatchMetadata> {
    // Klucze i tytuły zaznaczonych zgłoszeń pokazuje krok modalu. W trybie filtra nie ma czego
    // dociągać — celów nie zna nawet frontend.
    if (command.targetUuids?.length) {
      this._issues
        .loadAsync(command.targetUuids, {})
        .catch((err: unknown) =>
          console.error('[IssueSetAssigneeModalDefinition] Nie udało się pobrać zgłoszeń.', err),
        );
    }

    return ErpModalBuilder.modal<BatchCommandOfIssueSetAssigneeCommandAndSearchIssueRequest, ErpBatchMetadata>((b) =>
      b
        .setTitle([ISSUE_KEYS.title, ISSUE_KEYS.commands.setAssignee.modalTitle])
        .setCommand(command)
        .setMetadata(metadata)
        .addStep(ISSUE_KEYS.commands.setAssignee.label, IssueSetAssigneeStepComponent)
        .setSaveLabel(ISSUE_KEYS.commands.setAssignee.submitButton)
        .setOnSave(async (cmd) => {
          await this._issues.setAssigneeMultipleAsync(cmd, ISSUE_SET_ASSIGNEE_MODAL_ID);
        }),
    );
  }
}
