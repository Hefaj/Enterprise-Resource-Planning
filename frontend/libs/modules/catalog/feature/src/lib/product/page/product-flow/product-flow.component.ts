import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErpWorkflowComponent, WorkflowEdge, WorkflowNode, WorkflowNodeAction, WorkflowNodeType } from '@erp/shared/ui';

@Component({
  selector: 'erp-product-flow',
  standalone: true,
  imports: [CommonModule, ErpWorkflowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full w-full">
      <erp-workflow
        [(nodes)]="nodes"
        [(edges)]="edges"
        [readonlyMode]="readonlyMode()"
        [actions]="actions()"
        [availableNodeTypes]="availableNodeTypes()"
      >
        <ng-template let-node>
          @if (node.metadata?.assignedTo) {
            <div class="mx-4 mb-4 mt-2 p-2 bg-surface-100 dark:bg-surface-800 rounded-lg text-sm border border-surface-200 dark:border-surface-700 flex items-center gap-2">
              <i class="pi pi-user text-primary-500"></i>
              <span class="font-medium">{{ node.metadata.assignedTo }}</span>
            </div>
          }
        </ng-template>
      </erp-workflow>
    </div>
  `
})
export class ProductFlowComponent {
  readonlyMode = signal(false);

  availableNodeTypes = signal<WorkflowNodeType[]>([
    {
      label: 'Bloki Biznesowe',
      icon: 'pi pi-briefcase',
      items: [
        { type: 'start', label: 'Start (Początek)', defaultWidth: 200 },
        { type: 'action', label: 'Akcja (Zadanie)', defaultWidth: 200 },
        { type: 'end', label: 'Koniec (Zakończenie)', defaultWidth: 200 }
      ]
    },
    {
      label: 'Bloki Techniczne',
      icon: 'pi pi-cog',
      items: [
        { type: 'condition', label: 'Warunek (Bramka decyzyjna)', defaultWidth: 200 },
        { type: 'loop', label: 'Pętla (Cykl)', defaultWidth: 200 },
        { type: 'and', label: 'Rozwidlenie AND', defaultWidth: 60 },
        { type: 'or', label: 'Bramka OR (XOR)', defaultWidth: 60 }
      ]
    }
  ]);

  nodes = signal<WorkflowNode[]>([
    { id: 'start-1', type: 'start', label: 'Nowy Produkt', position: { x: 400, y: 50 }, width: 200, status: 'completed' },
    { id: 'and-1', type: 'and', label: '', position: { x: 470, y: 200 }, width: 60, status: 'completed' },
    { 
      id: 'action-1', 
      type: 'action', 
      label: 'Generowanie Zdjecia', 
      position: { x: 200, y: 350 }, 
      width: 200, 
      status: 'in-progress', 
      metadata: { assignedTo: 'Fotograf' },
      actions: [
        {
          label: 'Pobierz zdjęcie',
          icon: 'pi pi-download',
          command: () => alert('Pobieranie wygenerowanego zdjęcia...')
        }
      ]
    },
    { id: 'action-2', type: 'action', label: 'Pisanie Opisu', position: { x: 600, y: 350 }, width: 200, status: 'completed' },
    { id: 'condition-1', type: 'condition', label: 'Zdjecie Poprawne?', position: { x: 200, y: 500 }, width: 200, status: 'error' },
    { id: 'loop-1', type: 'loop', label: 'Retusz (Pętla)', position: { x: -50, y: 425 }, width: 150 },
    { id: 'or-1', type: 'or', label: '', position: { x: 470, y: 650 }, width: 60 },
    { id: 'action-3', status: 'in-progress', type: 'action', label: 'Akceptacja Marketingu', position: { x: 400, y: 800 }, width: 200 },
    { id: 'end-1', type: 'end', label: 'Publikacja', position: { x: 400, y: 950 }, width: 200 }
  ]);

  edges = signal<WorkflowEdge[]>([
    { id: 'e1', sourceId: 'start-1', targetId: 'and-1' },
    { id: 'e2', sourceId: 'and-1', targetId: 'action-1' },
    { id: 'e3', sourceId: 'and-1', targetId: 'action-2' },
    { id: 'e4', sourceId: 'action-1', targetId: 'condition-1' },
    { id: 'e5', sourceId: 'condition-1', targetId: 'loop-1', sourceHandle: 'false' },
    { id: 'e6', sourceId: 'loop-1', targetId: 'action-1' },
    { id: 'e7', sourceId: 'condition-1', targetId: 'or-1', sourceHandle: 'true' },
    { id: 'e8', sourceId: 'action-2', targetId: 'or-1' },
    { id: 'e9', sourceId: 'or-1', targetId: 'action-3' },
    { id: 'e10', sourceId: 'action-3', targetId: 'end-1' }
  ]);

  actions = signal<WorkflowNodeAction[]>([
    {
      label: 'Edytuj Metadane',
      icon: 'pi pi-pencil',
      command: ({ node }) => {
        alert(`Otwieranie modala dla węzła: ${node.label}`);
        console.log('Metadane:', node.metadata);
      }
    }
  ]);
}
