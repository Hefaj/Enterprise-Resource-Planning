import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { ErpButtonComponent, ErpInputComponent, ErpTranslatePipe } from '@erp/shared/ui';

import { ErpWorkflowTransitionCellComponent } from '../erp-workflow-transition-cell';
import { ErpWorkflowEditorConfig } from './erp-workflow-editor.types';

/**
 * Edytor macierzy przejść workflow „z → do" (`docs/modules/task-management/screens.md` §4.3).
 *
 * <p><b>Nie canvas grafu</b> — automat jest sekwencyjny, więc macierz jest tańsza i czytelniejsza
 * niż rysowanie (decyzja architektoniczna, nie niedoróbka — `domain.md` §5.4). Komórki renderuje
 * `erp-workflow-transition-cell`; ten komponent dokłada tylko siatkę i panel edycji wybranej
 * komórki. Orkiestracja (wybór komórki, zapis/usuń przejście) zostaje w feature.</p>
 */
@Component({
  selector: 'erp-workflow-editor',
  standalone: true,
  imports: [ErpButtonComponent, ErpInputComponent, ErpTranslatePipe, ErpWorkflowTransitionCellComponent, ReactiveFormsModule],
  template: `
    @let c = config();
    <div class="flex flex-col gap-3">
      <span class="text-sm font-medium">{{ c.title | erpTranslate }}</span>
      <span class="text-xs text-[var(--tui-text-secondary)]">{{ c.matrixHint | erpTranslate }}</span>

      @if (c.states.length < 2) {
        <span class="text-sm text-[var(--tui-text-secondary)]">{{ c.emptyLabel | erpTranslate }}</span>
      } @else {
        <div class="overflow-x-auto">
          <table class="text-sm">
            <thead>
              <tr>
                <th class="p-2"></th>
                @for (toState of c.states; track toState.uuid) {
                  <th class="p-2 text-left text-xs uppercase text-[var(--tui-text-tertiary)]">{{ toState.code }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (fromState of c.states; track fromState.uuid) {
                <tr class="border-t border-[var(--tui-border-normal)]">
                  <th class="p-2 text-left text-xs uppercase text-[var(--tui-text-tertiary)]">{{ fromState.code }}</th>
                  @for (toState of c.states; track toState.uuid) {
                    <td class="p-2">
                      @if (fromState.uuid !== toState.uuid) {
                        <erp-workflow-transition-cell [config]="c.getCellConfig(fromState, toState)" />
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (c.selectedCell; as cell) {
        <div class="flex flex-col gap-3 rounded-md border border-[var(--tui-border-normal)] p-4">
          <span class="text-sm font-medium">{{ c.formTitle(cell) | erpTranslate }}</span>

          <div class="grid grid-cols-2 gap-3">
            <erp-input [config]="c.nameKeyInputConfig" [control]="c.nameKeyControl" />
            <erp-input [config]="c.permissionInputConfig" [control]="c.permissionControl" />
            <erp-input [config]="c.fieldsInputConfig" [control]="c.fieldsControl" />
          </div>

          <div class="flex justify-end gap-2">
            @if (c.removeButton; as removeButton) {
              <erp-button [config]="removeButton" />
            }
            <erp-button [config]="c.cancelButton" />
            <erp-button [config]="c.saveButton" />
          </div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpWorkflowEditorComponent {
  public readonly config = input.required<ErpWorkflowEditorConfig>();
}
