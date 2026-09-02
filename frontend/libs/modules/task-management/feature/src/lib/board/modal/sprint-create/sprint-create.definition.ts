import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalConfig, ErpModalDefinition } from '@erp/shared/ui';
import { SprintCreateCommand, TaskManagementSprintOrchestrator } from '@erp/task-management/data-access';
import { SPRINT_CREATE_MODAL_ID } from '@erp/task-management/util';

import { SprintCreateStepComponent } from './sprint-create.step';
import { BOARD_KEYS } from '../../translation';

export type SprintCreateMetadata = Record<string, never>;

/**
 * Modal: utworzenie sprintu (SPR-001).
 *
 * <p>Uuid generuje klient, jak przy utworzeniu zgłoszenia — komenda idzie w trybie
 * <c>Commands[]</c>. <c>boardUuid</c> przychodzi już wypełniony przez wywołującego
 * ({@link BacklogStore}) i formularz go nie pokazuje: sprint zakłada się zawsze z poziomu
 * konkretnej tablicy, nigdy z ekranu bez kontekstu.</p>
 */
@Injectable({ providedIn: 'root' })
export class SprintCreateModalDefinition implements ErpModalDefinition<SprintCreateCommand, SprintCreateMetadata> {
  public readonly id = SPRINT_CREATE_MODAL_ID;

  private readonly _sprints = inject(TaskManagementSprintOrchestrator);

  public build(
    command: SprintCreateCommand,
    metadata?: SprintCreateMetadata,
  ): ErpModalConfig<SprintCreateCommand, SprintCreateMetadata> {
    return ErpModalBuilder.modal<SprintCreateCommand, SprintCreateMetadata>((b) =>
      b
        .setTitle([BOARD_KEYS.backlog.create.title])
        .setCommand(command)
        .setMetadata(metadata)
        .addStep(BOARD_KEYS.backlog.create.title, SprintCreateStepComponent)
        .setSaveLabel(BOARD_KEYS.backlog.create.submit)
        .setOnSave(async (cmd) => {
          await this._sprints.createMultipleAsync(cmd, SPRINT_CREATE_MODAL_ID);
        }),
    );
  }
}
