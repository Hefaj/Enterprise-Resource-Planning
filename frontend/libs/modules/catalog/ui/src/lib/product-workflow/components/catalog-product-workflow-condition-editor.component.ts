import { ChangeDetectionStrategy, Component, model, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { WorkflowNode } from '@erp/shared/ui';

@Component({
  selector: 'erp-catalog-product-workflow-condition-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, TableModule, SelectModule, InputNumberModule, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="'Zarządzaj warunkami: ' + (node()?.label || '')"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '600px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <div class="flex flex-col gap-4">
        <p-table
          [value]="tempConditions()"
          [responsiveLayout]="'scroll'"
          class="p-datatable-sm"
        >
          <ng-template pTemplate="header">
            <tr>
              <th>Pole</th>
              <th>Operator</th>
              <th>Wartość</th>
              <th style="width: 3rem"></th>
            </tr>
          </ng-template>
          <ng-template
            pTemplate="body"
            let-cond
            let-rowIndex="rowIndex"
          >
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
              <td
                colspan="4"
                class="text-center p-4 text-surface-500"
              >
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
        <p-button
          label="Anuluj"
          icon="pi pi-times"
          [text]="true"
          severity="secondary"
          (onClick)="visible.set(false)"
        />
        <p-button
          label="Zapisz"
          icon="pi pi-check"
          (onClick)="save()"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class CatalogProductWorkflowConditionEditorComponent {
  visible = model<boolean>(false);
  node = signal<WorkflowNode | null>(null);

  saveConditions = output<{ nodeId: string; conditions: any[] }>();

  tempConditions = signal<any[]>([]);

  fieldOptions = [
    { label: 'Wartość faktury', value: 'invoice_value' },
    { label: 'Kwota VAT', value: 'vat_amount' },
    { label: 'Cena netto', value: 'netto_price' },
    { label: 'Koszt dostawy', value: 'shipping_cost' },
  ];

  operatorOptions = ['==', '!=', '>', '<', '>=', '<='];

  open(node: WorkflowNode) {
    this.node.set(node);
    const existing = node.metadata?.['conditions'] || [];
    this.tempConditions.set(JSON.parse(JSON.stringify(existing)));
    this.visible.set(true);
  }

  addCondition() {
    this.tempConditions.update((current) => [...current, { id: Date.now(), field: 'invoice_value', fieldLabel: 'Wartość faktury', operator: '>', value: 0 }]);
  }

  removeCondition(index: number) {
    this.tempConditions.update((current) => current.filter((_, i) => i !== index));
  }

  onFieldChange(cond: any) {
    const option = this.fieldOptions.find((o) => o.value === cond.field);
    if (option) {
      cond.fieldLabel = option.label;
    }
  }

  save() {
    const node = this.node();
    if (node) {
      this.saveConditions.emit({
        nodeId: node.id,
        conditions: [...this.tempConditions()],
      });
    }
    this.visible.set(false);
  }
}
