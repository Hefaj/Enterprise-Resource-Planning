import { ChangeDetectionStrategy, Component, model, signal, viewChild, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpWorkflowComponent, WorkflowEdge, WorkflowNode, WorkflowNodeAction, WorkflowNodeType } from '@erp/shared/ui';
import { CatalogProductWorkflowMetadataComponent } from './components/catalog-product-workflow-metadata.component';
import { CatalogProductWorkflowConditionEditorComponent } from './components/catalog-product-workflow-condition-editor.component';
import { CatalogProductWorkflowApprovalEditorComponent } from './components/catalog-product-workflow-approval-editor.component';

@Component({
  selector: 'erp-catalog-product-workflow',
  standalone: true,
  imports: [
    CommonModule,
    ErpWorkflowComponent,
    CatalogProductWorkflowMetadataComponent,
    CatalogProductWorkflowConditionEditorComponent,
    CatalogProductWorkflowApprovalEditorComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full w-full">
      <erp-workflow
        [(nodes)]="nodes"
        [(edges)]="edges"
        [readonlyMode]="readonlyMode()"
        [actions]="actions()"
        [availableNodeTypes]="availableNodeTypes"
      >
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
  `
})
export class CatalogProductWorkflowComponent {
  nodes = model<WorkflowNode[]>([]);
  edges = model<WorkflowEdge[]>([]);
  readonlyMode = input<boolean>(false);
  actions = input<WorkflowNodeAction[]>([]);

  conditionEditor = viewChild(CatalogProductWorkflowConditionEditorComponent);
  approvalEditor = viewChild(CatalogProductWorkflowApprovalEditorComponent);

  availableNodeTypes: WorkflowNodeType[] = [
    {
      label: 'Bloki Biznesowe',
      icon: 'pi pi-briefcase',
      items: [
        { type: 'start', label: 'Start (Początek)', defaultWidth: 200 },
        { 
          type: 'action', 
          label: 'Akcja (Zadanie)', 
          defaultWidth: 200,
          actions: [
            {
              label: 'Pobierz zdjęcie',
              icon: 'pi pi-download',
              command: ({ node }) => alert('Pobieranie wygenerowanego zdjęcia...')
            }
          ]
        },
        { 
          type: 'approval', 
          label: 'Akceptacja (Zatwierdzenie)', 
          defaultWidth: 200,
          actions: [
            {
              label: 'Przypisz osobę',
              icon: 'pi pi-user-plus',
              command: ({ node }) => this.approvalEditor()?.open(node)
            }
          ]
        },
        { type: 'end', label: 'Koniec (Zakończenie)', defaultWidth: 200 }
      ]
    },
    {
      label: 'Bloki Techniczne',
      icon: 'pi pi-cog',
      items: [
        { 
          type: 'condition', 
          label: 'Warunek (Bramka decyzyjna)', 
          defaultWidth: 200,
          actions: [
            {
              label: 'Zarządzaj warunkami',
              icon: 'pi pi-filter',
              command: ({ node }) => this.conditionEditor()?.open(node)
            }
          ]
        },
        { type: 'loop', label: 'Pętla (Cykl)', defaultWidth: 200 },
        { type: 'and', label: 'Rozwidlenie AND', defaultWidth: 60 },
        { type: 'or', label: 'Bramka OR (XOR)', defaultWidth: 60 }
      ]
    }
  ];

  onSaveConditions(event: { nodeId: string, conditions: any[] }) {
    this.nodes.update(ns => ns.map(n => 
      n.id === event.nodeId 
        ? { ...n, metadata: { ...n.metadata, conditions: event.conditions } } 
        : n
    ));
  }

  onSaveApproval(event: { nodeId: string, assignedTo: string | null }) {
    this.nodes.update(ns => ns.map(n => 
      n.id === event.nodeId 
        ? { ...n, metadata: { ...n.metadata, assignedTo: event.assignedTo } } 
        : n
    ));
  }
}
