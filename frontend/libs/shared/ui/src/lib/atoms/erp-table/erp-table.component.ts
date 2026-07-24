import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  createAngularTable,
  FlexRenderDirective,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  ColumnDef,
  SortingState,
  PaginationState,
  VisibilityState,
  ColumnSizingState,
  RowSelectionState,
  ColumnFiltersState,
  ColumnOrderState,
  ColumnPinningState,
  flexRenderComponent,
} from '@tanstack/angular-table';
import { injectVirtualizer } from '@tanstack/angular-virtual';

import { TuiCheckbox, TuiRadio } from '@taiga-ui/core';
import { TuiIcon } from '@taiga-ui/core';
import { TuiSkeleton } from '@taiga-ui/kit';

import {
  ErpTableConfig,
  ErpTableState,
  ErpPaginationState,
} from './erp-table.types';
import { ErpTablePaginationComponent } from './erp-table-pagination.component';
import { ErpTableColumnMenuComponent } from './erp-table-column-menu.component';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpBadgedCellComponent } from './erp-badged-cell.component';

@Component({
  selector: 'erp-table-selection-cell',
  standalone: true,
  imports: [FormsModule, TuiCheckbox, TuiRadio],
  template: `
    @if (selectionMode() === 'single') {
      <input 
        tuiRadio 
        type="radio" 
        [name]="radioName"
        [value]="true"
        [ngModel]="checked() ? true : false" 
        (ngModelChange)="onModelChange($event === true)"
        [disabled]="disabled()" 
        (click)="onClick($event)" 
      />
    } @else {
      <input 
        tuiCheckbox 
        type="checkbox" 
        [ngModel]="checked()" 
        [indeterminate]="indeterminate()"
        (ngModelChange)="onModelChange($event)" 
        [disabled]="disabled()" 
        (click)="onClick($event)" 
      />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpTableSelectionCell {
  checked = input<boolean>(false);
  indeterminate = input<boolean>(false);
  disabled = input<boolean>(false);
  selectionMode = input<'single' | 'multi' | 'none'>('multi');
  changed = output<{ checked: boolean, shiftKey: boolean }>();
  radioName = `radio-${Math.random().toString(36).substring(2, 11)}`;

  private _lastShiftKey = false;

  onClick(event: MouseEvent) {
    event.stopPropagation();
    this._lastShiftKey = event.shiftKey;
  }

  onModelChange(val: boolean) {
    this.changed.emit({ checked: val, shiftKey: this._lastShiftKey });
    this._lastShiftKey = false;
  }
}

@Component({
  selector: 'erp-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FlexRenderDirective,
    TuiIcon,
    TuiSkeleton,
    ErpTranslatePipe,
    ErpTablePaginationComponent,
    ErpTableColumnMenuComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./erp-table.component.scss'],
  template: `
    <div class="erp-table-container" [class.erp-table--compact]="_compact()">
      
      <!-- Toolbar -->
      <div class="erp-table-toolbar flex flex-col md:flex-row justify-between items-center border-b border-(--erp-table-border)">
        
        <erp-table-pagination
          class="flex-1 w-full"
          [pageIndex]="table.getState().pagination.pageIndex"
          [pageSize]="table.getState().pagination.pageSize"
          [totalItems]="itemCount() || table.getPrePaginationRowModel().rows.length"
          [pageSizeOptions]="_pageSizeOptions()"
          (pageChange)="onPaginationChange($event)"
        />

        <div class="flex items-center gap-2 p-2 pl-0">
          <!-- Dodatkowe akcje (content projection) -->

          @if (_enableColumnVisibility()) {
            <div class="h-6 w-px bg-(--erp-table-border) hidden md:block mx-2"></div>
            <erp-table-column-menu
              [columns]="_columnMenuInfo()"
              (visibilityChange)="onVisibilityChange($event.id, $event.visible)"
              (pinChange)="onPinChange($event.id, $event.pin)"
              (orderChange)="onColumnMenuDrop($event)"
            />
          }
        </div>
      </div>

      <!-- Wrapper dla wirtualizacji / scrolla -->
      <div 
        #scrollElement 
        class="erp-table-scroll-wrapper relative overflow-auto" 
        [style.maxHeight]="_tableHeight()"
      >
        <table 
          class="erp-table w-full text-left border-collapse" 
          [class.erp-table--striped]="_striped()"
          [class.erp-table--bordered]="_bordered()"
          [style.width.px]="table.getTotalSize()"
        >
            <!-- <thead> -->
            <thead 
              class="erp-table__header bg-(--erp-table-header-bg) z-30"
              [class.sticky]="_stickyHeader()"
              [class.top-0]="_stickyHeader()"
            >
              @for (headerGroup of table.getHeaderGroups(); track headerGroup.id) {
                <tr>
                  @for (header of headerGroup.headers; track header.id) {
                    <th
                      class="erp-table__header-cell relative p-3 border-b border-(--erp-table-border) text-sm font-semibold whitespace-nowrap select-none group"
                      [style.width.px]="header.getSize()"
                      [attr.data-pinned]="header.column.getIsPinned()"
                      [class.erp-table__header-cell--pinned-left]="header.column.getIsPinned() === 'left'"
                      [class.erp-table__header-cell--pinned-right]="header.column.getIsPinned() === 'right'"
                      [class.erp-table__header-cell--pinned-left-last]="header.column.id === _lastLeftPinnedColumnId()"
                      [class.erp-table__header-cell--pinned-right-first]="header.column.id === _firstRightPinnedColumnId()"
                      [class.!overflow-visible]="header.id === '__selection'"
                      [class.top-0]="_stickyHeader()"
                      [style.left.px]="header.column.getIsPinned() === 'left' ? header.column.getStart('left') : null"
                      [style.right.px]="header.column.getIsPinned() === 'right' ? header.column.getAfter('right') : null"
                    >


                      <div class="flex flex-col min-w-0 w-full" [class.items-end]="$any(header.column.columnDef.meta)?.['align'] === 'right'" [class.items-center]="$any(header.column.columnDef.meta)?.['align'] === 'center'">
                        <!-- Zawartość nagłówka (Sortowanie) -->
                        <div 
                          class="flex items-center gap-1 cursor-pointer hover:text-(--tui-text-action) min-w-0"
                          (click)="header.column.getToggleSortingHandler()?.($event)"
                        >
                          <span class="truncate block">
                            <ng-container *flexRender="header.column.columnDef.header; props: header.getContext(); let headerValue">
                              {{ headerValue }}
                            </ng-container>
                          </span>
                          
                          <!-- Sort icon -->
                          @if (header.column.getCanSort()) {
                            <tui-icon 
                              [icon]="header.column.getIsSorted() === 'asc' ? '@tui.arrow-up' : header.column.getIsSorted() === 'desc' ? '@tui.arrow-down' : '@tui.arrow-up-down'" 
                              class="w-4 h-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              [class.opacity-100]="header.column.getIsSorted()"
                              [class.text-(--tui-text-action)]="header.column.getIsSorted()"
                            />
                          }
                        </div>
                        
                        <!-- Podtytuł (SubHeader) -->
                        @if ($any(header.column.columnDef.meta)?.['subHeader']; as subHeader) {
                          <span class="text-[0.6875rem] leading-none mt-0.5 text-(--tui-text-tertiary) truncate block font-normal w-full" [class.text-right]="$any(header.column.columnDef.meta)?.['align'] === 'right'" [class.text-center]="$any(header.column.columnDef.meta)?.['align'] === 'center'">
                            {{ subHeader | erpTranslate }}
                          </span>
                        }
                      </div>

                      <!-- Resizer -->
                      @if (header.column.getCanResize()) {
                        <div
                          class="erp-table__resizer absolute right-0 top-0 h-full w-3 cursor-col-resize select-none touch-none"
                          [class.is-resizing]="header.column.getIsResizing()"
                          (mousedown)="header.getResizeHandler()($event)"
                          (touchstart)="header.getResizeHandler()($event)"
                          (click)="$event.stopPropagation()"
                        ></div>
                      }
                    </th>
                  }
                </tr>
              }
            </thead>

            <!-- <tbody> -->
            <tbody class="erp-table__body">
              @if (table.getRowModel().rows.length === 0 && !loading()) {
                <tr>
                  <td [colSpan]="table.getVisibleFlatColumns().length" class="p-8 text-center text-(--erp-table-text-secondary)">
                    {{ 'shared.table.empty' | erpTranslate }}
                  </td>
                </tr>
              }
              
              @if (loading() && _skeletonRows() > 0 && table.getRowModel().rows.length === 0) {
                <!-- Skeleton rows -->
                @for (s of [].constructor(_skeletonRows()); track $index) {
                  <tr class="border-b border-(--erp-table-border)">
                    @for (col of table.getVisibleFlatColumns(); track col.id) {
                      <td class="p-3">
                        <div [tuiSkeleton]="true" class="h-4 w-3/4 rounded-sm"></div>
                      </td>
                    }
                  </tr>
                }
              }

              <!-- Wirtualizacja lub zwykła pętla -->
              @if (_enableVirtualScroll()) {
                <!-- Virtual Padding Top -->
                @if (virtualizer().getVirtualItems().length > 0) {
                  <tr>
                    <td [colSpan]="table.getVisibleFlatColumns().length" [style.height.px]="virtualizer().getVirtualItems()[0].start"></td>
                  </tr>
                }
                
                @for (virtualRow of virtualizer().getVirtualItems(); track virtualRow.key) {
                  @let row = table.getRowModel().rows[virtualRow.index];
                  <tr 
                    class="erp-table__row border-b border-(--erp-table-border) hover:bg-(--erp-table-row-hover) transition-colors"
                    [class.bg-(--erp-table-row-selected)]="row.getIsSelected()"
                    (click)="onRowClickEvent(row.original)"
                    (dblclick)="onRowDoubleClickEvent(row.original)"
                  >
                    @for (cell of row.getVisibleCells(); track cell.id) {
                      <td 
                        class="erp-table__cell p-3 text-sm {{ $any(cell.column.columnDef.meta)?.['cellClass'] || '' }}"
                        [style.width.px]="cell.column.getSize()"
                        [attr.data-pinned]="cell.column.getIsPinned()"
                        [class.erp-table__cell--pinned-left]="cell.column.getIsPinned() === 'left'"
                        [class.erp-table__cell--pinned-right]="cell.column.getIsPinned() === 'right'"
                        [class.erp-table__cell--pinned-left-last]="cell.column.id === _lastLeftPinnedColumnId()"
                        [class.erp-table__cell--pinned-right-first]="cell.column.id === _firstRightPinnedColumnId()"
                        [class.!overflow-visible]="cell.column.id === '__selection'"
                        [style.left.px]="cell.column.getIsPinned() === 'left' ? cell.column.getStart('left') : null"
                        [style.right.px]="cell.column.getIsPinned() === 'right' ? cell.column.getAfter('right') : null"
                        [class.text-right]="$any(cell.column.columnDef.meta)?.['align'] === 'right'"
                        [class.text-center]="$any(cell.column.columnDef.meta)?.['align'] === 'center'"
                      >
                        <ng-container *flexRender="cell.column.columnDef.cell; props: cell.getContext(); let cellValue">
                          <span [tuiSkeleton]="loading()" class="rounded-sm inline-flex items-center min-w-[3rem] min-h-[1.25rem] max-w-full">
                            {{ cellValue }}
                          </span>
                        </ng-container>
                      </td>
                    }
                  </tr>
                }

                <!-- Virtual Padding Bottom -->
                @if (virtualizer().getVirtualItems().length > 0) {
                  <tr>
                    <td [colSpan]="table.getVisibleFlatColumns().length" [style.height.px]="virtualizer().getTotalSize() - virtualizer().getVirtualItems()[virtualizer().getVirtualItems().length - 1].end"></td>
                  </tr>
                }
              } @else {
                <!-- Zwykła pętla -->
                @for (row of table.getRowModel().rows; track row.id) {
                  <tr 
                    class="erp-table__row border-b border-(--erp-table-border) hover:bg-(--erp-table-row-hover) transition-colors"
                    [class.bg-(--erp-table-row-selected)]="row.getIsSelected()"
                    (click)="onRowClickEvent(row.original)"
                    (dblclick)="onRowDoubleClickEvent(row.original)"
                  >
                    @for (cell of row.getVisibleCells(); track cell.id) {
                      <td 
                        class="erp-table__cell p-3 text-sm {{ $any(cell.column.columnDef.meta)?.['cellClass'] || '' }}"
                        [style.width.px]="cell.column.getSize()"
                        [attr.data-pinned]="cell.column.getIsPinned()"
                        [class.erp-table__cell--pinned-left]="cell.column.getIsPinned() === 'left'"
                        [class.erp-table__cell--pinned-right]="cell.column.getIsPinned() === 'right'"
                        [class.erp-table__cell--pinned-left-last]="cell.column.id === _lastLeftPinnedColumnId()"
                        [class.erp-table__cell--pinned-right-first]="cell.column.id === _firstRightPinnedColumnId()"
                        [class.!overflow-visible]="cell.column.id === '__selection'"
                        [style.left.px]="cell.column.getIsPinned() === 'left' ? cell.column.getStart('left') : null"
                        [style.right.px]="cell.column.getIsPinned() === 'right' ? cell.column.getAfter('right') : null"
                        [class.text-right]="$any(cell.column.columnDef.meta)?.['align'] === 'right'"
                        [class.text-center]="$any(cell.column.columnDef.meta)?.['align'] === 'center'"
                      >
                        <ng-container *flexRender="cell.column.columnDef.cell; props: cell.getContext(); let cellValue">
                          <span [tuiSkeleton]="loading()" class="rounded-sm inline-flex items-center min-w-[3rem] min-h-[1.25rem] max-w-full">
                            {{ cellValue }}
                          </span>
                        </ng-container>
                      </td>
                    }
                  </tr>
                }
              }
            </tbody>

            @if (_hasFooter()) {
              <tfoot class="erp-table__footer bg-(--erp-table-header-bg) z-20 sticky bottom-[-1px]">
                @for (footerGroup of table.getFooterGroups(); track footerGroup.id) {
                  <tr>
                    @for (footer of footerGroup.headers; track footer.id) {
                      <td
                        class="erp-table__footer-cell relative p-3 border-t border-(--erp-table-border) text-sm font-semibold whitespace-nowrap"
                        [style.width.px]="footer.getSize()"
                        [attr.data-pinned]="footer.column.getIsPinned()"
                        [class.erp-table__footer-cell--pinned-left]="footer.column.getIsPinned() === 'left'"
                        [class.erp-table__footer-cell--pinned-right]="footer.column.getIsPinned() === 'right'"
                        [class.erp-table__footer-cell--pinned-left-last]="footer.column.id === _lastLeftPinnedColumnId()"
                        [class.erp-table__footer-cell--pinned-right-first]="footer.column.id === _firstRightPinnedColumnId()"
                        [class.!overflow-visible]="footer.id === '__selection'"
                        [style.left.px]="footer.column.getIsPinned() === 'left' ? footer.column.getStart('left') : null"
                        [style.right.px]="footer.column.getIsPinned() === 'right' ? footer.column.getAfter('right') : null"
                      >
                        <div class="flex items-center gap-2 min-w-0" [class.justify-end]="$any(footer.column.columnDef.meta)?.['align'] === 'right'" [class.justify-center]="$any(footer.column.columnDef.meta)?.['align'] === 'center'">
                          <span class="truncate block">
                            @if (!footer.isPlaceholder && footer.column.columnDef.footer) {
                              <ng-container *flexRender="footer.column.columnDef.footer; props: footer.getContext(); let footerValue">
                                {{ footerValue }}
                              </ng-container>
                            }
                          </span>
                        </div>
                      </td>
                    }
                  </tr>
                }
              </tfoot>
            }
          </table>
      </div>

    </div>
  `,
})
export class ErpTableComponent<T> {
  config = input.required<ErpTableConfig<T>>();

  protected items = computed(() => unwrapSignal(this.config().items) ?? []);
  protected itemCount = computed(() => unwrapSignal(this.config().itemCount) ?? 0);
  protected loading = computed(() => unwrapSignal(this.config().loading) ?? false);


  scrollElement = viewChild<ElementRef<HTMLDivElement>>('scrollElement');

  // Computed configuration shortcuts
  protected _mode = computed(() => this.config().mode ?? 'server');
  protected _isServerMode = computed(() => this._mode() === 'server');
  protected _enableVirtualScroll = computed(() => this.config().enableVirtualScroll ?? false);
  protected _striped = computed(() => unwrapSignal(this.config().striped) ?? false);
  protected _bordered = computed(() => unwrapSignal(this.config().bordered) ?? true);
  protected _compact = computed(() => unwrapSignal(this.config().compact) ?? false);
  protected _stickyHeader = computed(() => this.config().stickyHeader ?? true);
  protected _tableHeight = computed(() => unwrapSignal(this.config().tableHeight) ?? 'auto');
  protected _emptyMessage = computed(() => unwrapSignal(this.config().emptyMessage) ?? 'shared.table.empty');
  protected _skeletonRows = computed(() => this.config().skeletonRows ?? this._pagination().pageSize);
  protected _pageSizeOptions = computed(() => this.config().pageSizeOptions ?? [10, 20, 50, 100]);
  protected _enableColumnReordering = computed(() => this.config().enableColumnReordering ?? true);
  protected _enableColumnVisibility = computed(() => this.config().enableColumnVisibility ?? true);
  protected _hasFooter = computed(() => this.config().columns.some(c => c.footer !== undefined));

  protected _lastLeftPinnedColumnId = computed(() => {
    const cols = this.table().getVisibleLeafColumns();
    const leftCols = cols.filter(c => c.getIsPinned() === 'left');
    return leftCols.length > 0 ? leftCols[leftCols.length - 1].id : null;
  });

  protected _firstRightPinnedColumnId = computed(() => {
    const cols = this.table().getVisibleLeafColumns();
    const rightCols = cols.filter(c => c.getIsPinned() === 'right');
    return rightCols.length > 0 ? rightCols[0].id : null;
  });

  // Signals for Table State
  private _sorting = signal<SortingState>([]);
  private _pagination = signal<PaginationState>({ pageIndex: 0, pageSize: 20 });
  private _columnVisibility = signal<VisibilityState>({});
  private _columnOrder = signal<string[]>([]);
  private _columnSizing = signal<ColumnSizingState>({});
  private _rowSelection = signal<RowSelectionState>({});
  private _columnFilters = signal<ColumnFiltersState>([]);
  private _lastSelectedRowId = signal<string | null>(null);
  private _columnPinning = signal<ColumnPinningState>({ left: [], right: [] });

  constructor() {
    // Initialize state from config if provided
    effect(() => {
      const state = this.config().initialState;
      if (state) {
        untracked(() => {
          if (state.sorting) {
            this._sorting.set(state.sorting.map(s => ({ id: s.columnId, desc: s.direction === 'desc' })));
          }
          if (state.pagination) {
            this._pagination.set(state.pagination);
          }
          if (state.columnVisibility) {
            this._columnVisibility.set(state.columnVisibility);
          }
          if (state.columnOrder) {
            this._columnOrder.set(state.columnOrder);
          }
          if (state.columnSizing) {
            this._columnSizing.set(state.columnSizing);
          }
          // Mapping row ids to row selection format { 'id': true }
          if (state.selectedRowIds) {
            const rowSelection: RowSelectionState = {};
            state.selectedRowIds.forEach(id => rowSelection[id] = true);
            this._rowSelection.set(rowSelection);
          }
        });
      }
      
      // Default pagination if not set by state
      if (!state?.pagination) {
        untracked(() => {
          this._pagination.update(p => ({ ...p, pageSize: this.config().defaultPageSize ?? 20 }));
        });
      }
      
      // Default column visibility & order
      untracked(() => {
        const defaultVisibility: VisibilityState = {};
        const defaultOrder: string[] = [];
        const defaultPinning: ColumnPinningState = { left: [], right: [] };
        
        if (this.config().selectionMode !== 'none') {
          defaultOrder.push('__selection');
          defaultPinning.left!.push('__selection');
        }
        
        for (const col of this.config().columns) {
          if (col.visible === false) {
            defaultVisibility[col.id] = false;
          }
          defaultOrder.push(col.id);
          
          if (col.pin === 'left') {
            defaultPinning.left!.push(col.id);
          } else if (col.pin === 'right') {
            defaultPinning.right!.push(col.id);
          }
        }
        
        if (!state?.columnVisibility) this._columnVisibility.set(defaultVisibility);
        if (!state?.columnOrder) this._columnOrder.set(defaultOrder);
        this._columnPinning.set(defaultPinning);
      });
    });

    // Effect to emit state changes (triggers data fetching in host components)
    effect(() => {
      // Re-run effect only on pagination, sorting, or filter changes
      const sorting = this._sorting().map(s => ({ columnId: s.id, direction: (s.desc ? 'desc' : 'asc') as 'asc' | 'desc' }));
      const pagination = this._pagination();
      const filters = this._extractFilters(this._columnFilters());

      untracked(() => {
        const state: ErpTableState = {
          sorting,
          pagination,
          filters,
          columnVisibility: this._columnVisibility(),
          columnOrder: this._columnOrder(),
          columnSizing: this._columnSizing(),
          selectedRowIds: new Set(Object.keys(this._rowSelection()).filter(k => this._rowSelection()[k])),
        };
        this.config().onStateChange?.(state);
      });
    });
  }

  private _extractFilters(filters: ColumnFiltersState): Record<string, any> {
    const res: Record<string, any> = {};
    filters.forEach(f => {
      res[f.id] = f.value;
    });
    return res;
  }

  // Map ERP columns to TanStack columns
  private _tanstackColumns = computed<ColumnDef<T>[]>(() => {
    const cols: ColumnDef<T>[] = [];
    const config = this.config();

    // Selection Column
    if (config.selectionMode !== 'none') {
      cols.push({
        id: '__selection',
        header: ({ table }) => {
          if (config.selectionMode === 'multi') {
            return flexRenderComponent(ErpTableSelectionCell, {
              inputs: {
                checked: table.getIsAllRowsSelected(),
                indeterminate: table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected(),
                selectionMode: config.selectionMode,
              },
              outputs: {
                changed: ({ checked }: { checked: boolean }) => table.toggleAllRowsSelected(checked)
              }
            });
          }
          return '';
        },
        cell: ({ row, table }) => {
          return flexRenderComponent(ErpTableSelectionCell, {
            inputs: {
              checked: row.getIsSelected(),
              disabled: !row.getCanSelect(),
              selectionMode: config.selectionMode,
            },
            outputs: {
              changed: ({ checked, shiftKey }: { checked: boolean, shiftKey: boolean }) => {
                if (shiftKey && this._lastSelectedRowId()) {
                  const rows = table.getRowModel().rows;
                  const lastIndex = rows.findIndex(r => r.id === this._lastSelectedRowId());
                  const currentIndex = rows.findIndex(r => r.id === row.id);
                  
                  if (lastIndex !== -1 && currentIndex !== -1) {
                    const start = Math.min(lastIndex, currentIndex);
                    const end = Math.max(lastIndex, currentIndex);
                    
                    const newSelection = { ...this._rowSelection() };
                    for (let i = start; i <= end; i++) {
                      if (rows[i].getCanSelect()) {
                        newSelection[rows[i].id] = checked;
                      }
                    }
                    table.setRowSelection(newSelection);
                  }
                } else {
                  row.toggleSelected(checked);
                }
                this._lastSelectedRowId.set(row.id);
              }
            }
          });
        },
        size: 48,
        minSize: 48,
        maxSize: 48,
        enableSorting: false,
        enableResizing: false,
        meta: { pin: 'left' },
      });
    }

    // Data Columns
    for (const col of config.columns) {
      cols.push({
        id: col.id,
        accessorKey: col.accessorKey as string,
        accessorFn: col.accessorFn,
        header: () => unwrapSignal(col.header),
        footer: col.footer ? () => unwrapSignal(col.footer) : undefined,
        cell: col.cell
          ? ({ row }) => flexRenderComponent(col.cell!, { inputs: { row: row.original, ...col.cellInputs } })
          : col.cellRichContent
          ? ({ getValue, row }) => flexRenderComponent(ErpBadgedCellComponent, {
              inputs: { content: col.cellRichContent!(getValue(), row.original) }
            })
          : col.cellFormatter
          ? ({ getValue, row }) => col.cellFormatter!(getValue(), row.original)
          : ({ getValue }) => getValue(),
        size: col.size ?? 150,
        minSize: col.minSize ?? 80,
        maxSize: col.maxSize,
        enableSorting: col.enableSorting ?? true,
        enableResizing: col.enableResizing ?? true,
        enableHiding: !col.disableHiding,
        meta: { 
          pin: col.pin, 
          align: col.align, 
          subHeader: col.subHeader ? unwrapSignal(col.subHeader) : undefined,
          cellClass: col.cellRichContent 
            ? (col.cellClass ? col.cellClass + ' erp-table__cell--rich-content' : 'erp-table__cell--rich-content') 
            : col.cellClass 
        },
      });
    }

    return cols;
  });

  // Main Table Instance
  protected table = createAngularTable<T>(() => ({
      data: this.items(),
      columns: this._tanstackColumns(),
      state: {
        sorting: this._sorting(),
        pagination: this._pagination(),
        columnVisibility: this._columnVisibility(),
        columnOrder: this._columnOrder(),
        columnSizing: this._columnSizing(),
        rowSelection: this._rowSelection(),
        columnFilters: this._columnFilters(),
        columnPinning: this._columnPinning(),
      },
      manualPagination: this._isServerMode(),
      manualSorting: this._isServerMode(),
      manualFiltering: this._isServerMode(),
      rowCount: this.itemCount(),
      
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: this._isServerMode() ? undefined : getSortedRowModel(),
      getPaginationRowModel: this._isServerMode() ? undefined : getPaginationRowModel(),
      getFilteredRowModel: this._isServerMode() ? undefined : getFilteredRowModel(),

      enableRowSelection: true,
      enableMultiRowSelection: this.config().selectionMode === 'multi',
      
      onSortingChange: (updaterOrValue: any) => {
        const newVal = typeof updaterOrValue === 'function' ? updaterOrValue(this._sorting()) : updaterOrValue;
        this._sorting.set(newVal);
        if (this._isServerMode()) {
          this.config().onSortChange?.(newVal.map((s: any) => ({ columnId: s.id, direction: s.desc ? 'desc' : 'asc' })));
        }
      },
      
      onPaginationChange: (updaterOrValue: any) => {
        const newVal = typeof updaterOrValue === 'function' ? updaterOrValue(this._pagination()) : updaterOrValue;
        this._pagination.set(newVal);
        if (this._isServerMode()) {
          this.config().onPaginationChange?.(newVal);
        }
      },
      
      onColumnVisibilityChange: (updaterOrValue: any) => {
        const newVal = typeof updaterOrValue === 'function' ? updaterOrValue(this._columnVisibility()) : updaterOrValue;
        this._columnVisibility.set(newVal);
      },
      
      onColumnOrderChange: (updaterOrValue: any) => {
        const newVal = typeof updaterOrValue === 'function' ? updaterOrValue(this._columnOrder()) : updaterOrValue;
        this._columnOrder.set(newVal);
      },
      
      onColumnPinningChange: (updaterOrValue: any) => {
        const newVal = typeof updaterOrValue === 'function' ? updaterOrValue(this._columnPinning()) : updaterOrValue;
        this._columnPinning.set(newVal);
      },
      
      onColumnSizingChange: (updaterOrValue: any) => {
        const newVal = typeof updaterOrValue === 'function' ? updaterOrValue(this._columnSizing()) : updaterOrValue;
        this._columnSizing.set(newVal);
      },

      onRowSelectionChange: (updaterOrValue: any) => {
        const newVal = typeof updaterOrValue === 'function' ? updaterOrValue(this._rowSelection()) : updaterOrValue;
        this._rowSelection.set(newVal);
        
        // Emit selected models
        // O(n) scan to find selected items - in a real huge data scenario we might want row models
        const selectedIds = Object.keys(newVal).filter(k => newVal[k]);
        const idAccessor = this.config().rowIdAccessor;
        const items = this.items();
        
        let selectedItems: T[] = [];
        if (idAccessor) {
          const selectedSet = new Set(selectedIds);
          selectedItems = items.filter(item => selectedSet.has(idAccessor(item)));
        } else {
          // If no idAccessor, TanStack uses index as string
          selectedItems = selectedIds.map(id => items[parseInt(id, 10)]).filter(Boolean);
        }
        
        this.config().onSelectionChange?.(selectedItems);
      },

      onColumnFiltersChange: (updaterOrValue: any) => {
        const newVal = typeof updaterOrValue === 'function' ? updaterOrValue(this._columnFilters()) : updaterOrValue;
        this._columnFilters.set(newVal);
        if (this._isServerMode()) {
          this.config().onFilterChange?.(this._extractFilters(newVal));
        }
      },

      columnResizeMode: 'onChange',
      enableColumnResizing: this.config().enableColumnResizing ?? true,
      enableMultiSort: this.config().enableMultiSort ?? true,
      getRowId: this.config().rowIdAccessor ? (row: T) => this.config().rowIdAccessor!(row) : undefined,
    })
  );

  // Virtualizer Instance
  protected virtualizer = injectVirtualizer(() => ({
    count: this.table().getRowModel().rows.length,
    scrollElement: this.scrollElement()?.nativeElement,
    estimateSize: () => this.config().estimatedRowHeight ?? 48,
    overscan: 5,
  }));

  // Column Menu Info for Toolbar
  protected _columnMenuInfo = computed(() => {
    const configCols = this.config().columns;
    return this.table().getAllLeafColumns()
      .filter(col => col.id !== '__selection')
      .map(col => {
        const originalCol = configCols.find(c => c.id === col.id);
        const headerText = originalCol ? unwrapSignal(originalCol.header) : col.id;
        return {
          id: col.id,
          header: headerText as string,
          visible: col.getIsVisible(),
          disableHiding: !col.getCanHide(),
          pin: col.getIsPinned()
        };
      });
  });

  // Handlers
  protected onPaginationChange(event: ErpPaginationState) {
    this.table().setPagination(event);
  }

  protected onVisibilityChange(id: string, visible: boolean) {
    this.table().getColumn(id)?.toggleVisibility(visible);
  }

  protected onPinChange(id: string, pin: 'left' | 'right' | false) {
    this.table().getColumn(id)?.pin(pin);
  }

  protected onColumnMenuDrop(newMenuOrder: string[]) {
    if (!this._enableColumnReordering()) return;
    
    // get existing order to see if '__selection' is there
    const currentOrder = this.table().getState().columnOrder;
    const selectionIdx = currentOrder.indexOf('__selection');
    
    const newOrder = [...newMenuOrder];
    // if __selection was present in original order, usually it's at index 0
    if (selectionIdx !== -1) {
       newOrder.unshift('__selection');
    }
    // Update global column order
    this.table().setColumnOrder(newOrder);

    // Update pinning arrays to reflect the new order
    const pinning = this.table().getState().columnPinning;
    if (pinning && (pinning.left?.length || pinning.right?.length)) {
      const newLeft = newOrder.filter(id => pinning.left?.includes(id));
      const newRight = newOrder.filter(id => pinning.right?.includes(id));
      
      this.table().setColumnPinning({
        left: newLeft,
        right: newRight
      });
    }
  }

  protected onRowClickEvent(row: T) {
    this.config().onRowClick?.(row);
  }

  protected onRowDoubleClickEvent(row: T) {
    this.config().onRowDoubleClick?.(row);
  }
}
