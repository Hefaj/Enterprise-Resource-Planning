import { Component, input, inject, ChangeDetectionStrategy } from '@angular/core';
import { TableModule } from 'primeng/table';
import { SelectionService } from './services/selection.service';
import { Overlay, OverlayRef, OverlayModule } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { ErpContextMenuComponent } from './components/erp-context-menu/erp-context-menu.component';
import { ContextMenuService } from './services/context-menu.service';
import { TableContextMenuConfig } from './models/context-menu.models';
import { TableConfig } from './models/table.models';

export type { TableConfig, TableContextMenuConfig };

@Component({
  selector: 'erp-table',
  standalone: true,
  imports: [TableModule, OverlayModule],
  providers: [SelectionService, ContextMenuService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="erp-table-wrapper border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
      <p-table
        [value]="data()"
        [columns]="config().columns"
        [lazy]="config().lazy"
        [virtualScroll]="config().virtualScroll ?? false"
        [virtualScrollItemSize]="40"
        [scrollHeight]="config().virtualScroll ? '400px' : 'auto'"
      >
        <ng-template
          pTemplate="header"
          let-columns
        >
          <tr class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
            @for (col of columns; track col.field) {
              <th class="p-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {{ col.header }}
              </th>
            }
          </tr>
        </ng-template>

        <ng-template
          pTemplate="body"
          let-rowData
          let-columns="columns"
        >
          <tr
            class="transition-colors duration-150 border-b border-slate-100 dark:border-slate-800/50 group"
            [class]="selectionService.isRowSelected(rowData.id) ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'"
            (click)="onRowClick($event, rowData)"
            (contextmenu)="onContextMenu($event, rowData)"
          >
            @for (col of columns; track col.field) {
              <td
                class="p-3 text-sm transition-all"
                [class.ring-2]="selectionService.isCellSelected(rowData.id, col.field)"
                [class.ring-blue-500]="selectionService.isCellSelected(rowData.id, col.field)"
                [class.ring-inset]="selectionService.isCellSelected(rowData.id, col.field)"
                [class.z-10]="selectionService.isCellSelected(rowData.id, col.field)"
                [class]="getCellClasses(rowData, col)"
                (click)="onCellClick($event, rowData, col)"
              >
                <div class="flex items-center justify-between">
                  <span [class.font-medium]="selectionService.isCellSelected(rowData.id, col.field)">
                    {{ rowData[col.field] }}
                  </span>

                  @if (col.editable) {
                    <i class="pi pi-pencil text-[10px] opacity-0 group-hover:opacity-40 dark:text-slate-500"></i>
                  }
                </div>
              </td>
            }
          </tr>
        </ng-template>
      </p-table>
    </div>
  `,
})
export class ErpTableComponent<T extends { id: string }> {
  public data = input.required<T[]>();
  public config = input.required<TableConfig<T>>();
  public menuConfig = input<TableContextMenuConfig>({ globalItems: [], dynamicItems: [] });

  private _overlay = inject(Overlay);
  private _contextMenuService = inject(ContextMenuService);
  private _overlayRef: OverlayRef | null = null;

  public selectionService = inject(SelectionService);

  /**
   * Generuje klasy dla komórki w zależności od jej stanu (editable, selected).
   */
  public getCellClasses(rowData: T, col: any): string {
    const isSelected = this.selectionService.isCellSelected(rowData.id, col.field);
    const classes = [];

    // Logika dla komórek edytowalnych (zaznaczalnych)
    if (col.editable) {
      classes.push('cursor-pointer relative');
      // Hover efekt tylko dla edytowalnych, jeśli nie są aktualnie wybrane
      if (!isSelected) {
        classes.push('hover:bg-blue-100/50 dark:hover:bg-blue-800/20');
      }
    }

    // Specyficzny kolor tła dla zaznaczonej komórki
    if (isSelected) {
      classes.push('bg-blue-100 dark:bg-blue-800/40 text-blue-700 dark:text-blue-200');
    } else {
      classes.push('text-slate-700 dark:text-slate-300');
    }

    return classes.join(' ');
  }

  public onRowClick(event: MouseEvent, rowData: T): void {
    const isEditableCell = (event.target as HTMLElement).closest('.cursor-pointer');
    if (!isEditableCell) {
      this.selectionService.select(rowData.id, 'row', undefined, event.ctrlKey || event.metaKey);
    }
  }

  public onCellClick(event: MouseEvent, rowData: T, col: any): void {
    if (col.editable) {
      event.stopPropagation();
      this.selectionService.select(rowData.id, 'cell', col.field, event.ctrlKey || event.metaKey);
    }
  }

  public onContextMenu(event: MouseEvent, rowData: T): void {
    event.preventDefault();
    this._closeMenu();

    const positionStrategy = this._overlay
      .position()
      .flexibleConnectedTo(event)
      .withPositions([{ originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' }]);

    this._overlayRef = this._overlay.create({
      positionStrategy,
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
    });

    const portal = new ComponentPortal(ErpContextMenuComponent);
    const componentRef = this._overlayRef.attach(portal);

    const items = this._contextMenuService.processItems([...this.menuConfig().globalItems, ...this.menuConfig().dynamicItems], this.selectionService.selection());

    componentRef.setInput('processedItems', items);
    componentRef.setInput('selection', this.selectionService.selection());
    componentRef.setInput('showSearch', items.length > 10);

    componentRef.instance.itemClick.subscribe((item) => {
      item.command?.(this.selectionService.selection());
      this._closeMenu();
    });

    this._overlayRef.backdropClick().subscribe(() => this._closeMenu());
  }

  private _closeMenu(): void {
    this._overlayRef?.dispose();
    this._overlayRef = null;
  }
}
