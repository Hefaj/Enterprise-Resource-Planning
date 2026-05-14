import { ChangeDetectionStrategy, Component, model, signal, viewChild, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpWorkflowComponent, WorkflowEdge, WorkflowNode, WorkflowNodeAction, WorkflowNodeType, workflowGroup, workflowNode, workflowAction, ErpWorkflowBuilder } from '@erp/shared/ui/erp-workflow';
import { CatalogProductWorkflowMetadataComponent } from './components/catalog-product-workflow-metadata.component';
import { CatalogProductWorkflowConditionEditorComponent } from './components/catalog-product-workflow-condition-editor.component';
import { CatalogProductWorkflowApprovalEditorComponent } from './components/catalog-product-workflow-approval-editor.component';

@Component({
  selector: 'erp-catalog-product-workflow',
  standalone: true,
  imports: [CommonModule, ErpWorkflowComponent, CatalogProductWorkflowMetadataComponent, CatalogProductWorkflowConditionEditorComponent, CatalogProductWorkflowApprovalEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full w-full">
      <erp-workflow [config]="workflowConfig">
        <ng-template let-node>
          <erp-catalog-product-workflow-metadata [node]="node" />
        </ng-template>
      </erp-workflow>

      <erp-catalog-product-workflow-condition-editor
        #conditionEditor
        (saveConditions)="onSaveConditions($event)"
      />

      <erp-catalog-product-workflow-approval-editor
        #approvalEditor
        (saveApproval)="onSaveApproval($event)"
      />
    </div>
  `,
})
export class CatalogProductWorkflowComponent {
  nodes = model<WorkflowNode[]>([]);
  edges = model<WorkflowEdge[]>([]);
  readonlyMode = input<boolean>(false);
  actions = input<WorkflowNodeAction[]>([]);

  conditionEditor = viewChild(CatalogProductWorkflowConditionEditorComponent);
  approvalEditor = viewChild(CatalogProductWorkflowApprovalEditorComponent);

  protected readonly workflowConfig = ErpWorkflowBuilder.create((b) =>
    b
      .setNodes(this.nodes)
      .setEdges(this.edges)
      .setReadonlyMode(this.readonlyMode)
      .setActions(this.actions)
      .setAvailableNodeTypes(computed(() => this.availableNodeTypes)),
  );

  availableNodeTypes: WorkflowNodeType[] = [
    workflowGroup('Bloki Biznesowe', 'pi pi-briefcase', [
      workflowNode('start', 'Start (Początek)'),
      workflowNode('action', 'Akcja (Zadanie)', {
        actions: [workflowAction('Pobierz zdjęcie', 'pi pi-download', () => alert('Pobieranie wygenerowanego zdjęcia...'))],
      }),
      workflowNode('approval', 'Akceptacja (Zatwierdzenie)', {
        actions: [workflowAction('Przypisz osobę', 'pi pi-user-plus', ({ node }) => this.approvalEditor()?.open(node))],
      }),
      workflowNode('end', 'Koniec (Zakończenie)'),
    ]),
    workflowGroup('Bloki Techniczne', 'pi pi-cog', [
      workflowNode('condition', 'Warunek (Bramka decyzyjna)', {
        actions: [workflowAction('Zarządzaj warunkami', 'pi pi-filter', ({ node }) => this.conditionEditor()?.open(node))],
      }),
      workflowNode('loop', 'Pętla (Cykl)'),
      workflowNode('and', 'Rozwidlenie AND', { defaultWidth: 60 }),
      workflowNode('or', 'Bramka OR (XOR)', { defaultWidth: 60 }),
    ]),
  ];

  onSaveConditions(event: { nodeId: string; conditions: any[] }) {
    this.nodes.update((ns) => ns.map((n) => (n.id === event.nodeId ? { ...n, metadata: { ...n.metadata, conditions: event.conditions } } : n)));
  }

  onSaveApproval(event: { nodeId: string; assignedTo: string | null }) {
    this.nodes.update((ns) => ns.map((n) => (n.id === event.nodeId ? { ...n, metadata: { ...n.metadata, assignedTo: event.assignedTo } } : n)));
  }
}
