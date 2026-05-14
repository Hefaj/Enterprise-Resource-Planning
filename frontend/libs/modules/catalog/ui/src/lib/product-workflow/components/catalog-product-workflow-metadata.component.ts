import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkflowNode } from '@erp/shared/ui/erp-workflow';

@Component({
  selector: 'erp-catalog-product-workflow-metadata',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Metadata: Assigned To -->
    @if (node().metadata?.['assignedTo']) {
      <div class="mx-4 mb-4 mt-2 p-2 bg-surface-100 dark:bg-surface-800 rounded-lg text-sm border border-surface-200 dark:border-surface-700 flex items-center gap-2">
        <i class="pi pi-user text-primary-500"></i>
        <span class="font-medium">{{ node().metadata?.['assignedTo'] }}</span>
      </div>
    }

    <!-- Metadata: Conditions (IF block) -->
    @if (node().type === 'condition' && conditions().length) {
      <div class="mx-4 mb-4 mt-2 flex flex-col gap-2">
        @for (cond of conditions(); track cond.id) {
          <div class="p-2 bg-surface-100 dark:bg-surface-800 rounded-lg text-xs border border-surface-200 dark:border-surface-700 flex flex-wrap items-center gap-1">
            <span class="text-surface-500">{{ cond.fieldLabel }}</span>
            <span class="font-bold text-primary-500">{{ cond.operator }}</span>
            <span class="font-medium">{{ cond.value | number: '1.2-2' }}</span>
          </div>
        }
      </div>
    } @else if (node().type === 'condition') {
      <div class="mx-4 mb-4 mt-2 p-3 border-2 border-dashed border-surface-200 dark:border-surface-700 rounded-lg text-center text-xs text-surface-400">Brak zdefiniowanych warunków</div>
    }
  `,
})
export class CatalogProductWorkflowMetadataComponent {
  node = input.required<WorkflowNode>();
  conditions = computed(() => (this.node().metadata?.['conditions'] as any[]) || []);
}
