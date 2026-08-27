import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalConfig, ErpModalDefinition } from '@erp/shared/ui';
import {
  IssueCreateCommand,
  TaskManagementIssueOrchestrator,
  TaskManagementProjectOrchestrator,
} from '@erp/task-management/data-access';
import { ISSUE_CREATE_MODAL_ID } from '@erp/task-management/util';

import { IssueCreateStepComponent } from './issue-create.step';
import { ISSUE_KEYS } from '../../translation';

export type IssueCreateMetadata = Record<string, never>;

/**
 * Modal: utworzenie zgłoszenia.
 *
 * <p>Komenda idzie w trybie <c>Commands[]</c>, więc uuid generuje klient — robi to
 * <c>createIssueAsync</c>, nie ten formularz. <b>Klucza czytelnego nie ma w polach i być nie
 * może</b>: nadaje go serwer z licznika projektu, w tej samej transakcji co zapis
 * (`docs/backend/task-management.md` §4).</p>
 *
 * <p>Stanu początkowego też nie wybiera użytkownik — bierze go schemat projektu
 * (`WorkflowScheme.InitialState`), bo „w jakim stanie powstaje zgłoszenie" jest konfiguracją
 * projektu, a nie decyzją zgłaszającego.</p>
 */
@Injectable({ providedIn: 'root' })
export class IssueCreateModalDefinition implements ErpModalDefinition<IssueCreateCommand, IssueCreateMetadata> {
  public readonly id = ISSUE_CREATE_MODAL_ID;

  private readonly _issues = inject(TaskManagementIssueOrchestrator);
  private readonly _projects = inject(TaskManagementProjectOrchestrator);

  public build(
    command: IssueCreateCommand,
    metadata?: IssueCreateMetadata,
  ): ErpModalConfig<IssueCreateCommand, IssueCreateMetadata> {
    // Projekty są nieliczne (dziesiątki), więc picker dostaje pełną listę bez paginacji.
    this._projects
      .searchAsync({ page: 1, pageSize: 200 })
      .catch((err: unknown) => console.error('[IssueCreateModalDefinition] Nie udało się pobrać projektów.', err));

    return ErpModalBuilder.modal<IssueCreateCommand, IssueCreateMetadata>((b) =>
      b
        .setTitle([ISSUE_KEYS.title, ISSUE_KEYS.commands.create.modalTitle])
        .setCommand(command)
        .setMetadata(metadata)
        .addStep(ISSUE_KEYS.commands.create.label, IssueCreateStepComponent)
        .setSaveLabel(ISSUE_KEYS.commands.create.submitButton)
        .setOnSave(async (cmd) => {
          await this._issues.createIssueAsync(cmd, ISSUE_CREATE_MODAL_ID);
        }),
    );
  }
}
