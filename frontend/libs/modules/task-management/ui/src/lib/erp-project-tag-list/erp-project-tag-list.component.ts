import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import {
  ErpButtonComponent,
  ErpInputComponent,
  ErpInputPickerComponent,
  ErpTranslatePipe,
} from '@erp/shared/ui';

import { ErpProjectTagListConfig } from './erp-project-tag-list.types';

/** Katalog tagów projektu — renderuje interakcje wiersza, bez wiedzy o tagach ani orkiestratorze. */
@Component({
  selector: 'erp-project-tag-list',
  standalone: true,
  imports: [ErpButtonComponent, ErpInputComponent, ErpInputPickerComponent, ErpTranslatePipe],
  template: `
    <table class="w-full text-sm">
      <tbody>
        @for (row of this.config().rows; track row.id) {
          <tr class="border-t border-[var(--tui-border-normal)]">
            <td class="w-6 py-2">
              <span class="inline-block h-3 w-3 rounded-full" [style.background-color]="row.color"></span>
            </td>
            <td class="py-2">
              @if (row.editing) {
                <erp-input class="w-48" [config]="this.config().renameInputConfig" [control]="this.config().renameControl" />
              } @else {
                {{ row.name }}
              }
            </td>
            <td class="py-2 text-right">
              @for (action of row.actions; track $index) {
                <erp-button [config]="action" />
              }
            </td>
          </tr>

          @if (row.merging && row.merge; as merge) {
            <tr>
              <td colspan="3" class="pb-3">
                <div class="flex flex-col gap-2 rounded-md border border-[var(--tui-border-normal)] p-3">
                  <span class="text-xs text-[var(--tui-text-secondary)]">{{ merge.message | erpTranslate }}</span>
                  <erp-input-picker class="w-64" [config]="merge.pickerConfig" [control]="merge.pickerControl" />
                  <div class="flex justify-end"><erp-button [config]="merge.confirmButton" /></div>
                </div>
              </td>
            </tr>
          }
        }
      </tbody>
    </table>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpProjectTagListComponent {
  public readonly config = input.required<ErpProjectTagListConfig>();
}
