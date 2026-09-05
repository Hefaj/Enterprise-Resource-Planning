import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ErpTranslatePipe, unwrapSignal } from '@erp/shared/ui';

import { ErpWorkflowTransitionCellConfig } from './erp-workflow-transition-cell.types';

/** Klikalna komórka macierzy workflow — wyłącznie prezentacja, bez znajomości DTO lub komend. */
@Component({
  selector: 'erp-workflow-transition-cell',
  standalone: true,
  imports: [ErpTranslatePipe],
  template: `
    <button
      type="button"
      class="min-w-24 rounded border border-[var(--tui-border-normal)] px-2 py-1 text-left text-xs hover:bg-[var(--tui-background-neutral-1)]"
      (click)="this.config().onSelect()"
    >
      @if (this.transitionNameKey(); as nameKey) {
        <span class="block truncate">{{ nameKey | erpTranslate }}</span>
        <span class="flex gap-1 text-[10px] text-[var(--tui-text-tertiary)]">
          @if (this.requiredPermission()) {
            <span>🔒 {{ this.permissionBadgeKey() | erpTranslate }}</span>
          }
          @if (this.requiredFieldsCount() > 0) {
            <span>📋 {{ this.fieldsBadgeKey() | erpTranslate }}</span>
          }
        </span>
      } @else {
        <span class="text-[var(--tui-text-tertiary)]">{{ this.addLabelKey() | erpTranslate }}</span>
      }
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpWorkflowTransitionCellComponent {
  public readonly config = input.required<ErpWorkflowTransitionCellConfig>();

  protected readonly transitionNameKey = computed(() => unwrapSignal(this.config().transitionNameKey));
  protected readonly requiredPermission = computed(() => unwrapSignal(this.config().requiredPermission) ?? false);
  protected readonly requiredFieldsCount = computed(() => unwrapSignal(this.config().requiredFieldsCount) ?? 0);
  protected readonly addLabelKey = computed(() => unwrapSignal(this.config().addLabelKey));
  protected readonly permissionBadgeKey = computed(() => unwrapSignal(this.config().permissionBadgeKey));
  protected readonly fieldsBadgeKey = computed(() => unwrapSignal(this.config().fieldsBadgeKey));
}
