import { ChangeDetectionStrategy, Component, model, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { WorkflowNode } from '@erp/shared/ui/erp-workflow';

@Component({
  selector: 'erp-catalog-product-workflow-approval-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    SelectModule,
    ButtonModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog 
      [header]="'Przypisz osobę akceptującą: ' + (node()?.label || '')" 
      [(visible)]="visible" 
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
        <p-button label="Anuluj" icon="pi pi-times" [text]="true" severity="secondary" (onClick)="visible.set(false)" />
        <p-button label="Przypisz" icon="pi pi-check" (onClick)="save()" />
      </ng-template>
    </p-dialog>
  `
})
export class CatalogProductWorkflowApprovalEditorComponent {
  visible = model<boolean>(false);
  node = signal<WorkflowNode | null>(null);
  
  saveApproval = output<{ nodeId: string, assignedTo: string | null }>();

  selectedUser: string | null = null;

  userOptions = [
    { label: 'Jan Kowalski (Manager)', value: 'Jan Kowalski' },
    { label: 'Anna Nowak (Dyrektor)', value: 'Anna Nowak' },
    { label: 'Piotr Wiśniewski (Lead)', value: 'Piotr Wiśniewski' },
    { label: 'Maria Zielińska (Marketing)', value: 'Maria Zielińska' }
  ];

  open(node: WorkflowNode) {
    this.node.set(node);
    this.selectedUser = (node.metadata?.['assignedTo'] as string) || null;
    this.visible.set(true);
  }

  save() {
    const node = this.node();
    if (node) {
      this.saveApproval.emit({
        nodeId: node.id,
        assignedTo: this.selectedUser
      });
    }
    this.visible.set(false);
  }
}
