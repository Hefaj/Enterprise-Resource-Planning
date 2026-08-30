import { Injectable, inject } from '@angular/core';
import { ErpBatchMetadata, ErpModalBuilder, ErpModalConfig, ErpModalDefinition } from '@erp/shared/ui';
import { BatchCommandOfIssueSetStateCommandAndSearchIssueRequest, ProjectFieldDto, ProjectWorkflowService, TaskManagementIssueOrchestrator } from '@erp/task-management/data-access';
import { ISSUE_SET_STATE_MODAL_ID } from '@erp/task-management/util';

import { IssueSetStateStepComponent } from './issue-set-state.step';
import { IssueSetStateFieldsStepComponent } from './issue-set-state-fields.step';
import { ISSUE_KEYS } from '../../translation';

/**
 * Poza standardowym `targetCount` modal potrzebuje kontekstu projektu: stany pochodzą ze
 * schematu projektu, a nie z globalnego enumu, więc bez wskazania projektu nie ma z czego
 * zbudować listy wyboru.
 */
export interface IssueSetStateMetadata extends ErpBatchMetadata {
  /** Projekt z przełącznika kontekstu na liście; puste = wyliczany z celów operacji. */
  projectUuid?: string;
  requiredFields?: readonly ProjectFieldDto[];
}

/**
 * Modal: seryjna zmiana stanu zgłoszeń.
 *
 * <p><b>Wymaga jednego projektu.</b> Kolumny i stany są konfiguracją projektu
 * (`docs/backend/task-management.md` §5), więc lista wyboru istnieje tylko wtedy, gdy wszystkie
 * cele należą do jednego projektu albo gdy lista jest zawężona kontekstem projektu. Przy
 * zaznaczeniu z kilku projektów krok pokazuje komunikat zamiast pustego pickera — inaczej
 * użytkownik wybierałby stan, który dla części celów nie istnieje, i połowa elementów zadania
 * odpadłaby błędem `taskmgmt.transition_unknown_state`.</p>
 */
@Injectable({ providedIn: 'root' })
export class IssueSetStateModalDefinition implements ErpModalDefinition<BatchCommandOfIssueSetStateCommandAndSearchIssueRequest, IssueSetStateMetadata> {
  public readonly id = ISSUE_SET_STATE_MODAL_ID;

  private readonly _issues = inject(TaskManagementIssueOrchestrator);
  private readonly _workflow = inject(ProjectWorkflowService);

  public build(
    command: BatchCommandOfIssueSetStateCommandAndSearchIssueRequest,
    metadata?: IssueSetStateMetadata,
  ): ErpModalConfig<BatchCommandOfIssueSetStateCommandAndSearchIssueRequest, IssueSetStateMetadata> {
    // Klucze i projekty zaznaczonych zgłoszeń pokazuje krok modalu. W trybie filtra nie ma czego
    // dociągać — celów nie zna nawet frontend.
    if (command.targetUuids?.length) {
      this._issues.loadAsync(command.targetUuids, {}).catch((err: unknown) => console.error('[IssueSetStateModalDefinition] Nie udało się pobrać zgłoszeń.', err));
    }

    const projectUuid = metadata?.projectUuid ?? command.targetFilter?.projectUuid;
    if (projectUuid) {
      this._workflow.loadAsync(projectUuid).catch((err: unknown) => console.error('[IssueSetStateModalDefinition] Nie udało się pobrać schematu.', err));
    }

    return ErpModalBuilder.modal<BatchCommandOfIssueSetStateCommandAndSearchIssueRequest, IssueSetStateMetadata>((b) =>
      b
        .setTitle([ISSUE_KEYS.title, ISSUE_KEYS.commands.setState.modalTitle])
        .setCommand(command)
        .setMetadata(metadata)
        .addStep(ISSUE_KEYS.commands.setState.label, (metadata?.requiredFields?.length ? IssueSetStateFieldsStepComponent : IssueSetStateStepComponent) as unknown as typeof IssueSetStateStepComponent)
        .setSaveLabel(ISSUE_KEYS.commands.setState.submitButton)
        .setOnSave(async (cmd) => {
          return this._issues.setStateMultipleAsync(cmd, ISSUE_SET_STATE_MODAL_ID);
        }),
    );
  }
}
