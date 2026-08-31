import { Injectable, inject } from '@angular/core';

import { ErpBatchMetadata, ErpModalBuilder, ErpModalConfig, ErpModalDefinition } from '@erp/shared/ui';
import { BatchCommandOfIssueSetProjectCommandAndSearchIssueRequest, TaskManagementIssueOrchestrator, TaskManagementProjectOrchestrator } from '@erp/task-management/data-access';
import { ISSUE_SET_PROJECT_MODAL_ID } from '@erp/task-management/util';

import { IssueSetProjectStepComponent } from './issue-set-project.step';
import { ISSUE_KEYS } from '../../translation';

/**
 * Modal: seryjne przeniesienie zgłoszeń do innego projektu.
 *
 * <p>Operacja jest widoczna dla użytkownika w trzech skutkach naraz — nowy klucz, stan wracający
 * do początkowego i zmiana granicy widoczności — więc krok modalu je wypisuje. To nie jest
 * ostrzeżenie na wszelki wypadek: przeniesienie jest jedyną operacją w tym module, która
 * zmienia klucz czytelny zgłoszenia.</p>
 */
@Injectable({ providedIn: 'root' })
export class IssueSetProjectModalDefinition implements ErpModalDefinition<BatchCommandOfIssueSetProjectCommandAndSearchIssueRequest, ErpBatchMetadata> {
  public readonly id = ISSUE_SET_PROJECT_MODAL_ID;

  private readonly _issues = inject(TaskManagementIssueOrchestrator);
  private readonly _projects = inject(TaskManagementProjectOrchestrator);

  public build(
    command: BatchCommandOfIssueSetProjectCommandAndSearchIssueRequest,
    metadata?: ErpBatchMetadata,
  ): ErpModalConfig<BatchCommandOfIssueSetProjectCommandAndSearchIssueRequest, ErpBatchMetadata> {
    // Lista projektów bywa zimna, gdy modal otwiera się z ekranu, który jej nie potrzebował
    // (np. karta zgłoszenia) — bez tego picker pokazałby pustkę.
    this._projects.searchAsync({ page: 1, pageSize: 200 }, { autoLoad: true }).catch((err: unknown) => console.error('[IssueSetProjectModalDefinition] Nie udało się pobrać projektów.', err));

    if (command.targetUuids?.length) {
      this._issues.loadAsync(command.targetUuids, {}).catch((err: unknown) => console.error('[IssueSetProjectModalDefinition] Nie udało się pobrać zgłoszeń.', err));
    }

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
