import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalConfig, ErpModalDefinition, ErpToastService } from '@erp/shared/ui';
import {
  TaskManagementWorkflowSchemeOrchestrator,
  WorkflowSchemeExecPublishCommand,
  WorkflowSchemePublishPreviewDto,
} from '@erp/task-management/data-access';
import { WORKFLOW_SCHEME_PUBLISH_MODAL_ID } from '@erp/task-management/util';

import { WorkflowSchemePublishStepComponent } from './workflow-scheme-publish.step';
import { PROJECT_KEYS } from '../../translation';

/** Metadane modalu publikacji: podgląd pobrany PRZED otwarciem (`GetWorkflowSchemePublishPreview`),
 * żeby ekran mapowania miał od razu liczbę zgłoszeń per usuwany stan i listę stanów docelowych. */
export interface WorkflowSchemePublishMetadata {
  readonly preview: WorkflowSchemePublishPreviewDto;
}

/**
 * Modal: publikacja usunięcia stanów ze schematu, z mapowaniem migracji zgłoszeń (WF-006).
 *
 * <p>Jeden krok, bo decyzja jest płaska — dla każdego usuwanego stanu jeden picker celu.
 * Zapisanie zakłada zadanie masowe (`WorkflowSchemeExecPublishCommand` → job/job_item po stronie
 * backendu); front nie czeka na jego zakończenie, tylko pokazuje toast, że ruszyło, i odsyła do
 * dzwonka powiadomień po postęp.</p>
 */
@Injectable({ providedIn: 'root' })
export class WorkflowSchemePublishModalDefinition
  implements ErpModalDefinition<WorkflowSchemeExecPublishCommand, WorkflowSchemePublishMetadata>
{
  public readonly id = WORKFLOW_SCHEME_PUBLISH_MODAL_ID;

  private readonly _schemes = inject(TaskManagementWorkflowSchemeOrchestrator);
  private readonly _toast = inject(ErpToastService);

  public build(
    command: WorkflowSchemeExecPublishCommand,
    metadata?: WorkflowSchemePublishMetadata,
  ): ErpModalConfig<WorkflowSchemeExecPublishCommand, WorkflowSchemePublishMetadata> {
    return ErpModalBuilder.modal<WorkflowSchemeExecPublishCommand, WorkflowSchemePublishMetadata>((b) =>
      b
        .setTitle(PROJECT_KEYS.detail.workflow.publish.modalTitle)
        .setCommand(command)
        .setMetadata(metadata)
        .addStep(PROJECT_KEYS.detail.workflow.publish.modalTitle, WorkflowSchemePublishStepComponent)
        .setSaveLabel(PROJECT_KEYS.detail.workflow.publish.submit)
        .setOnSave(async (cmd) => {
          await this._schemes.execPublishAsync(cmd, WORKFLOW_SCHEME_PUBLISH_MODAL_ID);
          this._toast.show({ message: PROJECT_KEYS.detail.workflow.publish.started, appearance: 'positive' });
        }),
    );
  }
}
