import { Injectable, inject } from '@angular/core';
import { ErpModalBuilder, ErpModalConfig, ErpModalDefinition } from '@erp/shared/ui';
import { SprintExecCloseCommand, TaskManagementSprintOrchestrator } from '@erp/task-management/data-access';
import { SPRINT_EXEC_CLOSE_MODAL_ID } from '@erp/task-management/util';

import { SprintExecCloseStepComponent } from './sprint-exec-close.step';
import { BOARD_KEYS } from '../../translation';

/** Sprinty planowane tej samej tablicy, do których można przenieść niedokończone zgłoszenia —
 * zamykany sprint jest z tej listy wyłączony przez wywołującego ({@link BacklogStore}). */
export interface SprintExecCloseMetadata {
  readonly candidateSprints: readonly { readonly uuid: string; readonly name: string }[];
}

/**
 * Modal: zamknięcie sprintu (SPR-003).
 *
 * <p><b>Jedna decyzja, bez której formularz nie da się zapisać</b>: dokąd trafiają niedokończone
 * zgłoszenia. Nie ma opcji „zostaw jak jest" — zamknięty sprint jest tylko do odczytu
 * (`taskmgmt.sprint_closed`), więc karta zostałaby przypisana do iteracji, której nie da się
 * już zmienić.</p>
 */
@Injectable({ providedIn: 'root' })
export class SprintExecCloseModalDefinition
  implements ErpModalDefinition<SprintExecCloseCommand, SprintExecCloseMetadata>
{
  public readonly id = SPRINT_EXEC_CLOSE_MODAL_ID;

  private readonly _sprints = inject(TaskManagementSprintOrchestrator);

  public build(
    command: SprintExecCloseCommand,
    metadata?: SprintExecCloseMetadata,
  ): ErpModalConfig<SprintExecCloseCommand, SprintExecCloseMetadata> {
    return ErpModalBuilder.modal<SprintExecCloseCommand, SprintExecCloseMetadata>((b) =>
      b
        .setTitle([BOARD_KEYS.backlog.close.title])
        .setCommand(command)
        .setMetadata(metadata)
        .addStep(BOARD_KEYS.backlog.close.title, SprintExecCloseStepComponent)
        .setSaveLabel(BOARD_KEYS.backlog.close.submit)
        .setOnSave(async (cmd) => {
          await this._sprints.execCloseMultipleAsync(cmd, SPRINT_EXEC_CLOSE_MODAL_ID);
        }),
    );
  }
}
