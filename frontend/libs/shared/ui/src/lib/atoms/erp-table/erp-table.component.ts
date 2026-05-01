import { Component, input, inject, ChangeDetectionStrategy } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { SelectionService } from './services/selection.service';
import { Overlay, OverlayRef, OverlayModule } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { ErpContextMenuComponent } from './components/erp-context-menu/erp-context-menu.component';
import { ContextMenuService } from './services/context-menu.service';
import { TableContextMenuConfig } from './models/context-menu.models';
import { TableConfig, TableColumn } from './models/table.models';

export type { TableConfig, TableContextMenuConfig, TableColumn };

@Component({
  selector: 'erp-table',
  standalone: true,
  imports: [TableModule, OverlayModule, TooltipModule, NgClass, NgTemplateOutlet],
  providers: [SelectionService, ContextMenuService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="erp-table-wrapper border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
      <p-table
        [value]="data()"
        [columns]="config().columns"
        [lazy]="config().lazy ?? false"
        [virtualScroll]="config().virtualScroll ?? false"
        [virtualScrollItemSize]="config().virtualScrollItemSize ?? 40"
        [scrollHeight]="config().scrollHeight ?? (config().virtualScroll ? '400px' : 'auto')"
        [rowHover]="config().rowHover ?? true"
        [stripedRows]="config().stripedRows ?? false"
        [tableStyle]="{'table-layout': 'fixed', 'min-width': '1000px'}"
      >
        <!-- NAGŁÓWEK -->
        <ng-template pTemplate="header" let-columns>
          <tr class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
            @for (col of columns; track col.field) {
              <th
                pFrozenColumn
                [frozen]="col.frozen ?? false"
                [alignFrozen]="col.alignFrozen ?? 'left'"
                class="p-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap"
                [style.width]="col.width"
                [style.minWidth]="col.width"
                [style.maxWidth]="col.width"
              >
                {{ col.header }}
              </th>
            }
          </tr>
        </ng-template>

        <!-- CIAŁO TABELI -->
        <ng-template pTemplate="body" let-rowData let-columns="columns">
          <tr
            class="transition-colors duration-150 border-b border-slate-100 dark:border-slate-800/50 group"
            [class.cursor-pointer]="isSelectionMode('row')"
            [class.!bg-blue-500/20]="isRowSelected(rowData.id)"
            (click)="onRowClick($event, rowData)"
            (contextmenu)="onContextMenu($event, rowData)"
          >
            @for (col of columns; track col.field) {
              <td
                pFrozenColumn
                [frozen]="col.frozen ?? false"
                [alignFrozen]="col.alignFrozen ?? 'left'"
                class="p-3 text-sm transition-all"
                [ngClass]="getCellClasses(rowData, col)"
                [class.!bg-blue-500/20]="isRowSelected(rowData.id)"
                [style.width]="col.width"
                [style.minWidth]="col.width"
                [style.maxWidth]="col.width"
                (click)="onCellClick($event, rowData, col)"
              >
                <!-- RENDEROWANIE KOMÓRKI W ZALEŻNOŚCI OD TYPU -->
                @switch (col.type) {
                  @case ('text') {
                    <span class="block truncate" [title]="rowData[col.field]">
                      {{ rowData[col.field] }}
                    </span>
                  }
                  
                  @case ('multiline') {
                    <div class="whitespace-pre-wrap break-words">
                      {{ rowData[col.field] }}
                    </div>
                  }
                  
                  @case ('icon') {
                    @if (col.iconConfig) {
                      <i 
                        [class]="col.iconConfig.getIcon?.(rowData) ?? ''" 
                        [ngClass]="col.iconConfig.getColorClass?.(rowData) ?? ''"
                      ></i>
                    }
                  }
                  
                  @case ('image') {
                    @if (col.imageConfig) {
                      <img 
                        [src]="rowData[col.field]" 
                        [alt]="col.imageConfig.alt ?? ''"
                        [style.width]="col.imageConfig.width ?? '40px'"
                        [style.height]="col.imageConfig.height ?? 'auto'"
                        [class]="col.imageConfig.cssClass ?? 'rounded object-cover'"
                      />
                    }
                  }
                  
                  @case ('pill') {
                    <div class="flex flex-wrap gap-1">
                      @for (pill of getPillData(rowData, col); track pill.value) {
                        <span 
                          class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                          [ngClass]="pill.colorClass ?? 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'"
                          [pTooltip]="pill.tooltip ?? ''"
                          tooltipPosition="top"
                        >
                          @if (pill.icon) {
                            <i [class]="pill.icon + ' mr-1 text-[10px]'"></i>
                          }
                          {{ pill.value }}
                        </span>
                      }
                    </div>
                  }
                  
                  @case ('custom') {
                    @if (col.template) {
                      <ng-container *ngTemplateOutlet="col.template; context: { $implicit: rowData, column: col }"></ng-container>
                    }
                  }
                }

                <!-- Ikona edycji na hover (jeśli komórka edytowalna/selekcjonowalna) -->
                @if (col.editable && isSelectionMode('cell')) {
                  <i class="pi pi-pencil absolute right-2 top-1/2 -translate-y-1/2 text-[10px] opacity-0 group-hover:opacity-40 dark:text-slate-500"></i>
                }
              </td>
            }
          </tr>
        </ng-template>
        
        <!-- PUSTY STAN -->
        <ng-template pTemplate="emptymessage" let-columns>
          <tr>
            <td [attr.colspan]="columns.length" class="p-6 text-center text-slate-500 dark:text-slate-400">
              Brak danych do wyświetlenia.
            </td>
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

  public isSelectionMode(type: 'row' | 'cell' | 'checkbox'): boolean {
    const config = this.config();
    return config.selection?.type === type && config.selection?.mode !== 'none';
  }

  public isRowSelected(rowId: string): boolean {
    return this.selectionService.isRowSelected(rowId);
  }

  public getCellClasses(rowData: T, col: TableColumn<T>): string {
    const classes = ['relative'];
    
    // Obsługa selekcji komórkowej
    if (this.isSelectionMode('cell') && col.editable) {
      classes.push('cursor-pointer');
      const isSelected = this.selectionService.isCellSelected(rowData.id, col.field);
      
      if (isSelected) {
        classes.push('ring-2 ring-blue-500 ring-inset z-10 bg-blue-100 dark:bg-blue-800/40 text-blue-700 dark:text-blue-200');
      } else {
        classes.push('hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-700 dark:text-slate-300');
      }
    } else {
      classes.push('text-slate-700 dark:text-slate-300');
    }

    return classes.join(' ');
  }

  public getPillData(rowData: T, col: TableColumn<T>): any[] {
    if (!col.pillConfig?.getPillOptions) return [];
    
    const result = col.pillConfig.getPillOptions(rowData);
    return Array.isArray(result) ? result : [result];
  }

  public onRowClick(event: MouseEvent, rowData: T): void {
    console.log('ERP-TABLE: Row clicked', rowData.id, this.config().selection);
    if (!this.isSelectionMode('row')) return;
    
    const isEditableCell = (event.target as HTMLElement).closest('.cursor-pointer');
    if (!isEditableCell) {
      const isMulti = this.config().selection?.mode === 'multiple' && (event.ctrlKey || event.metaKey);
      const isRange = this.config().selection?.mode === 'multiple' && event.shiftKey;
      this.selectionService.select(rowData.id, 'row', undefined, isMulti, isRange);
    }
  }

  public onCellClick(event: MouseEvent, rowData: T, col: TableColumn<T>): void {
    if (this.isSelectionMode('cell') && col.editable) {
      event.stopPropagation();
      const isMulti = this.config().selection?.mode === 'multiple' && (event.ctrlKey || event.metaKey);
      const isRange = this.config().selection?.mode === 'multiple' && event.shiftKey;
      this.selectionService.select(rowData.id, 'cell', col.field, isMulti, isRange);
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
