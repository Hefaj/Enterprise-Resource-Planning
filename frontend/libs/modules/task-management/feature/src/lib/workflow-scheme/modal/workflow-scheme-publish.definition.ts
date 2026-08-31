import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ErpModalBuilder, ErpModalConfig, ErpModalDefinition } from '@erp/shared/ui';
import { IssueExecStateMigrationCommand, TaskManagementClient, WorkflowSchemeExecPublishCommand, WorkflowStateDefinitionDto } from '@erp/task-management/data-access';
import { WORKFLOW_SCHEME_PUBLISH_MODAL_ID } from '@erp/task-management/util';
import { WORKFLOW_KEYS } from '../translation';
import { WorkflowSchemePublishStepComponent } from './workflow-scheme-publish.step';

export interface WorkflowSchemePublishMetadata {
  readonly removedStates: readonly WorkflowStateDefinitionDto[];
}

@Injectable({ providedIn: 'root' })
export class WorkflowSchemePublishModalDefinition implements ErpModalDefinition<WorkflowSchemeExecPublishCommand, WorkflowSchemePublishMetadata> {
  public readonly id = WORKFLOW_SCHEME_PUBLISH_MODAL_ID;
  private readonly _api = inject(TaskManagementClient);
  public build(command: WorkflowSchemeExecPublishCommand, metadata?: WorkflowSchemePublishMetadata): ErpModalConfig<WorkflowSchemeExecPublishCommand, WorkflowSchemePublishMetadata> {
    return ErpModalBuilder.modal<WorkflowSchemeExecPublishCommand, WorkflowSchemePublishMetadata>((b) =>
      b
        .setTitle([WORKFLOW_KEYS.title, WORKFLOW_KEYS.publish])
        .setCommand(command)
        .setMetadata(metadata)
        .addStep(WORKFLOW_KEYS.mapping, WorkflowSchemePublishStepComponent as unknown as never)
        .setSaveLabel(WORKFLOW_KEYS.publish)
        .setOnSave(async (cmd) => {
          await firstValueFrom(this._api.workflowSchemeExecPublishCommand(cmd));
          for (const removed of metadata?.removedStates ?? []) {
            const target = cmd.removedStateMappings?.[removed.uuid ?? ''];
            if (!target || !removed.uuid) continue;
            await firstValueFrom(
              this._api.issueExecStateMigrationMultipleCommand({
                templateCommand: { schemeUuid: cmd.schemeUuid, fromStateUuid: removed.uuid, toStateUuid: target } as IssueExecStateMigrationCommand,
                targetFilter: { schemeUuid: cmd.schemeUuid, fromStateUuid: removed.uuid },
                queueId: 'taskmgmt.workflow.publish',
              }),
            );
          }
        }),
    );
  }
}
