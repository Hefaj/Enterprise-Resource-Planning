import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ErpWorkflowComponent, WorkflowEdge, WorkflowNode, WorkflowNodeAction, WorkflowNodeType } from '@erp/shared/ui';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'erp-product-flow',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    ErpWorkflowComponent,
    DialogModule,
    TableModule,
    SelectModule,
    InputNumberModule,
    ButtonModule,
    TooltipModule
  ],
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
          <!-- Metadata: Assigned To -->
          @if (node.metadata?.assignedTo) {
            <div class="mx-4 mb-4 mt-2 p-2 bg-surface-100 dark:bg-surface-800 rounded-lg text-sm border border-surface-200 dark:border-surface-700 flex items-center gap-2">
              <i class="pi pi-user text-primary-500"></i>
              <span class="font-medium">{{ node.metadata.assignedTo }}</span>
            </div>
          }

          <!-- Metadata: Conditions (IF block) -->
          @if (node.type === 'condition' && node.metadata?.conditions?.length) {
            <div class="mx-4 mb-4 mt-2 flex flex-col gap-2">
              @for (cond of node.metadata.conditions; track cond.id) {
                <div class="p-2 bg-surface-100 dark:bg-surface-800 rounded-lg text-xs border border-surface-200 dark:border-surface-700 flex flex-wrap items-center gap-1">
                  <span class="text-surface-500">{{ cond.fieldLabel }}</span>
                  <span class="font-bold text-primary-500">{{ cond.operator }}</span>
                  <span class="font-medium">{{ cond.value | number:'1.2-2' }}</span>
                </div>
              }
            </div>
          } @else if (node.type === 'condition') {
            <div class="mx-4 mb-4 mt-2 p-3 border-2 border-dashed border-surface-200 dark:border-surface-700 rounded-lg text-center text-xs text-surface-400">
              Brak zdefiniowanych warunków
            </div>
          }
        </ng-template>
      </erp-workflow>

      <!-- Condition Editor Dialog -->
      <p-dialog 
        [header]="'Zarządzaj warunkami: ' + (selectedNode()?.label || '')" 
        [(visible)]="displayConditionEditor" 
        [modal]="true" 
        [style]="{ width: '600px' }"
        [draggable]="false"
        [resizable]="false"
      >
        <div class="flex flex-col gap-4">
          <p-table [value]="tempConditions()" [responsiveLayout]="'scroll'" class="p-datatable-sm">
            <ng-template pTemplate="header">
              <tr>
                <th>Pole</th>
                <th>Operator</th>
                <th>Wartość</th>
                <th style="width: 3rem"></th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-cond let-rowIndex="rowIndex">
              <tr>
                <td>
                  <p-select 
                    [options]="fieldOptions" 
                    [(ngModel)]="cond.field" 
                    optionLabel="label" 
                    optionValue="value"
                    placeholder="Wybierz pole"
                    appendTo="body"
                    (onChange)="onFieldChange(cond)"
                    [style]="{ width: '100%' }"
                  />
                </td>
                <td>
                  <p-select 
                    [options]="operatorOptions" 
                    [(ngModel)]="cond.operator" 
                    placeholder="Operator"
                    appendTo="body"
                    [style]="{ width: '100%' }"
                  />
                </td>
                <td>
                  <p-inputNumber 
                    [(ngModel)]="cond.value" 
                    [minFractionDigits]="2"
                    [maxFractionDigits]="2"
                    placeholder="Kwota"
                    [style]="{ width: '100%' }"
                  />
                </td>
                <td>
                  <p-button 
                    icon="pi pi-trash" 
                    [text]="true" 
                    severity="danger" 
                    (onClick)="removeCondition(rowIndex)" 
                  />
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="4" class="text-center p-4 text-surface-500">
                  Brak warunków. Dodaj pierwszy warunek poniżej.
                </td>
              </tr>
            </ng-template>
          </p-table>

          <p-button 
            label="Dodaj warunek" 
            icon="pi pi-plus" 
            [text]="true" 
            (onClick)="addCondition()" 
          />
        </div>

        <ng-template pTemplate="footer">
          <p-button label="Anuluj" icon="pi pi-times" [text]="true" severity="secondary" (onClick)="displayConditionEditor = false" />
          <p-button label="Zapisz" icon="pi pi-check" (onClick)="saveConditions()" />
        </ng-template>
      </p-dialog>

      <!-- Approval Editor Dialog -->
      <p-dialog 
        [header]="'Przypisz osobę akceptującą: ' + (selectedApprovalNode()?.label || '')" 
        [(visible)]="displayApprovalEditor" 
        [modal]="true" 
        [style]="{ width: '400px' }"
        [draggable]="false"
        [resizable]="false"
      >
        <div class="flex flex-col gap-4 py-4">
          <label class="font-medium text-sm">Wybierz osobę z listy:</label>
          <p-select 
            [options]="userOptions" 
            [(ngModel)]="selectedUser" 
            optionLabel="label" 
            optionValue="value"
            placeholder="Wybierz osobę"
            appendTo="body"
            [style]="{ width: '100%' }"
          />
        </div>

        <ng-template pTemplate="footer">
          <p-button label="Anuluj" icon="pi pi-times" [text]="true" severity="secondary" (onClick)="displayApprovalEditor = false" />
          <p-button label="Przypisz" icon="pi pi-check" (onClick)="saveApproval()" />
        </ng-template>
      </p-dialog>
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
              command: ({ node }) => this.openApprovalEditor(node)
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
              command: ({ node }) => this.openConditionEditor(node)
            }
          ]
        },
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
      metadata: { assignedTo: 'Fotograf' }
    },
    { id: 'action-2', type: 'action', label: 'Pisanie Opisu', position: { x: 600, y: 350 }, width: 200, status: 'completed' },
    { 
      id: 'condition-1', 
      type: 'condition', 
      label: 'Zdjecie Poprawne?', 
      position: { x: 200, y: 500 }, 
      width: 200, 
      status: 'error', 
      metadata: { 
        conditions: [
          { id: 1, field: 'netto_price', fieldLabel: 'Cena netto', operator: '>', value: 1000 }
        ] 
      }
    },
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
      label: 'Edytuj Nazwę',
      icon: 'pi pi-pencil',
      command: ({ node }) => {
        const newLabel = prompt('Nowa nazwa węzła:', node.label);
        if (newLabel !== null) {
          this.nodes.update(ns => ns.map(n => n.id === node.id ? { ...n, label: newLabel } : n));
        }
      }
    }
  ]);

  // --- Condition Logic ---

  displayConditionEditor = false;
  selectedNode = signal<WorkflowNode | null>(null);
  tempConditions = signal<any[]>([]);

  fieldOptions = [
    { label: 'Wartość faktury', value: 'invoice_value' },
    { label: 'Kwota VAT', value: 'vat_amount' },
    { label: 'Cena netto', value: 'netto_price' },
    { label: 'Koszt dostawy', value: 'shipping_cost' }
  ];

  operatorOptions = ['==', '!=', '>', '<', '>=', '<='];

  openConditionEditor(node: WorkflowNode) {
    this.selectedNode.set(node);
    // Clone existing conditions or start with empty array
    const existing = node.metadata?.['conditions'] || [];
    this.tempConditions.set(JSON.parse(JSON.stringify(existing)));
    this.displayConditionEditor = true;
  }

  addCondition() {
    this.tempConditions.update(current => [
      ...current,
      { id: Date.now(), field: 'invoice_value', fieldLabel: 'Wartość faktury', operator: '>', value: 0 }
    ]);
  }

  removeCondition(index: number) {
    this.tempConditions.update(current => current.filter((_, i) => i !== index));
  }

  onFieldChange(cond: any) {
    const option = this.fieldOptions.find(o => o.value === cond.field);
    if (option) {
      cond.fieldLabel = option.label;
    }
  }

  saveConditions() {
    const node = this.selectedNode();
    if (!node) return;

    this.nodes.update(ns => ns.map(n => 
      n.id === node.id 
        ? { ...n, metadata: { ...n.metadata, conditions: [...this.tempConditions()] } } 
        : n
    ));

    this.displayConditionEditor = false;
  }

  // --- Approval Logic ---

  displayApprovalEditor = false;
  selectedApprovalNode = signal<WorkflowNode | null>(null);
  selectedUser: string | null = null;

  userOptions = [
    { label: 'Jan Kowalski (Manager)', value: 'Jan Kowalski' },
    { label: 'Anna Nowak (Dyrektor)', value: 'Anna Nowak' },
    { label: 'Piotr Wiśniewski (Lead)', value: 'Piotr Wiśniewski' },
    { label: 'Maria Zielińska (Marketing)', value: 'Maria Zielińska' }
  ];

  openApprovalEditor(node: WorkflowNode) {
    this.selectedApprovalNode.set(node);
    this.selectedUser = (node.metadata?.['assignedTo'] as string) || null;
    this.displayApprovalEditor = true;
  }

  saveApproval() {
    const node = this.selectedApprovalNode();
    if (node) {
      this.nodes.update(ns => ns.map(n => 
        n.id === node.id 
          ? { ...n, metadata: { ...n.metadata, assignedTo: this.selectedUser } } 
          : n
      ));
    }
    this.displayApprovalEditor = false;
  }

  /**
   * Przykład pobrania danych do wysyłki na backend.
   * Ponieważ używamy sygnałów i Two-Way Binding, 'nodes' i 'edges' są zawsze aktualne.
   */
  saveFlow() {
    // 1. Pobieramy wartości z sygnałów
    const currentNodes = this.nodes();
    const currentEdges = this.edges();

    // 2. Przygotowujemy dane do wysyłki (tzw. DTO)
    // Ważne: usuwamy pole 'actions', ponieważ zawiera ono funkcje (JS), 
    // których nie da się zamienić na JSON.
    const nodesToSave = currentNodes.map(({ actions, ...nodeData }) => nodeData);

    const payload = {
      nodes: nodesToSave,
      edges: currentEdges
    };

    // 3. Wysyłamy na backend (przykład logowania)
    console.log('Dane gotowe do POST:', payload);
    alert('Dane zostały przygotowane. Szczegóły w konsoli (F12).');
    
    // return this.http.post('/api/workflow', payload);
  }
}
