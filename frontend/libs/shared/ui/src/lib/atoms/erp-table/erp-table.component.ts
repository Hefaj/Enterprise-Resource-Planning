import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  Input,
  AfterViewInit,
  inject,
  computed,
  effect,
  ElementRef,
  input,
  output,
  signal,
  untracked,
  viewChild,
  DestroyRef,
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
  Row,
} from '@tanstack/angular-table';
import { injectVirtualizer } from '@tanstack/angular-virtual';

import { TuiCheckbox, TuiRadio, TuiDropdown, TuiButton, TuiAppearance } from '@taiga-ui/core';
import { TuiIcon } from '@taiga-ui/core';
import { TuiSkeleton, TuiChip } from '@taiga-ui/kit';

import {
  ErpTableConfig,
  ErpTableState,
  ErpPaginationState,
  ErpCellChip,
  ErpColumnDef,
  ErpColumnGroupDef,
  isColumnGroupDef,
  ErpSelectionState,
} from './erp-table.types';
import { ErpTablePaginationComponent } from './erp-table-pagination.component';
import { ErpTableColumnMenuComponent } from './erp-table-column-menu.component';
import { unwrapSignal } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpChipCellComponent } from './erp-chip-cell.component';
import { ErpSwitchComponent } from '../../form/erp-switch/erp-switch.component';

@Directive({
  selector: '[erpVirtualMeasure]',
  standalone: true
})
export class ErpVirtualMeasureDirective implements AfterViewInit {
  private el = inject(ElementRef);
  
  @Input('erpVirtualMeasure') virtualizer!: any;
  @Input() index!: number;

  ngAfterViewInit() {
    if (this.virtualizer) {
      this.virtualizer.measureElement(this.el.nativeElement);
    }
  }
}

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
  styles: [`
    :host {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
    }
  `]
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
    TuiChip,
    TuiButton,
    TuiDropdown,
    TuiAppearance,
    ErpSwitchComponent,
    ErpTranslatePipe,
    ErpTablePaginationComponent,
    ErpTableColumnMenuComponent,
    ErpVirtualMeasureDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./erp-table.component.scss'],
  template: `
    <div class="erp-table-container" [class.erp-table--compact]="_compact()">
      
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
          <colgroup>
            @for (col of _getOrderedColumns(); track col.id) {
              <col [style.width.px]="col.getSize()" />
            }
          </colgroup>
            <!-- <thead> -->
            <thead 
              class="erp-table__header bg-(--erp-table-header-bg) z-30"
              [class.sticky]="_stickyHeader()"
              [class.top-0]="_stickyHeader()"
            >
              @for (headerGroup of table.getHeaderGroups(); track headerGroup.id) {
                <tr>
                  @for (header of _getOrderedHeaders(headerGroup); track header.id) {
                    @if (!header.isPlaceholder) {
                      <th
                        class="erp-table__header-cell relative p-3 text-sm font-semibold whitespace-nowrap select-none group {{ $any(header.column.columnDef.meta)?.['headerClass'] || '' }}"
                        [colSpan]="header.colSpan"
                        [style.width.px]="header.colSpan === 1 ? header.getSize() : null"
                        [attr.data-pinned]="header.column.getIsPinned()"
                        [class.erp-table__header-cell--pinned-left]="header.column.getIsPinned() === 'left'"
                        [class.erp-table__header-cell--pinned-right]="header.column.getIsPinned() === 'right'"
                        [class.erp-table__header-cell--pinned-left-last]="header.column.id === _lastLeftPinnedColumnId()"
                        [class.erp-table__header-cell--pinned-right-first]="header.column.id === _firstRightPinnedColumnId()"
                        [class.!overflow-visible]="header.id === '__selection'"
                        [class.erp-table__header-cell--group]="header.colSpan > 1"
                        [style.left.px]="header.column.getIsPinned() === 'left' ? header.column.getStart('left') : null"
                        [style.right.px]="header.column.getIsPinned() === 'right' ? header.column.getAfter('right') : null"
                      >

                        @if (header.subHeaders && header.subHeaders.length > 0) {
                          <!-- Nagłówek grupy (parent) — bez sortowania i resizera -->
                          <div class="flex items-center gap-1 min-w-0">
                            <span class="truncate block text-xs uppercase tracking-wider text-(--tui-text-secondary)">
                              <ng-container *flexRender="header.column.columnDef.header; props: header.getContext(); let headerValue">
                                {{ headerValue | erpTranslate }}
                              </ng-container>
                            </span>
                          </div>
                        } @else {
                          <!-- Nagłówek kolumny liścia (leaf) — z sortowaniem i resizerem -->
                          <div class="flex flex-col min-w-0 w-full" [class.items-end]="$any(header.column.columnDef.meta)?.['align'] === 'right'" [class.items-center]="$any(header.column.columnDef.meta)?.['align'] === 'center'">
                            <!-- Zawartość nagłówka (Sortowanie) -->
                            <div 
                              class="flex items-center gap-1 cursor-pointer hover:text-(--tui-text-action) min-w-0"
                              (click)="header.column.getToggleSortingHandler()?.($event)"
                            >
                              <span class="truncate block">
                                <ng-container *flexRender="header.column.columnDef.header; props: header.getContext(); let headerValue">
                                  {{ headerValue | erpTranslate }}
                                </ng-container>
                              </span>
                              
                              <!-- Sort icon -->
                              @if (header.column.getCanSort()) {
                                <div class="relative flex items-center shrink-0">
                                  <tui-icon 
                                    [icon]="header.column.getIsSorted() === 'asc' ? '@tui.arrow-up' : header.column.getIsSorted() === 'desc' ? '@tui.arrow-down' : '@tui.arrow-up-down'" 
                                    class="w-4 h-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    [class.opacity-100]="header.column.getIsSorted()"
                                    [class.text-(--tui-text-action)]="header.column.getIsSorted()"
                                  />
                                  @if (header.column.getSortIndex() !== -1 && _sorting().length > 1) {
                                    <span 
                                      tuiBadge
                                      appearance="accent"
                                      class="absolute -top-1.5 -right-2.5 transform scale-[0.8] origin-center z-10 px-1 py-0 leading-none min-w-[1.25rem] flex items-center justify-center font-bold"
                                    >
                                      {{ header.column.getSortIndex() + 1 }}
                                    </span>
                                  }
                                </div>
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
                        }
                      </th>
                    } @else {
                      <!-- Placeholder header (pusta komórka w wierszu grupowym dla kolumn bez grupy) -->
                      <th
                        class="erp-table__header-cell relative p-3"
                        [colSpan]="header.colSpan"
                        [style.width.px]="header.getSize()"
                        [attr.data-pinned]="header.column.getIsPinned()"
                        [class.erp-table__header-cell--pinned-left]="header.column.getIsPinned() === 'left'"
                        [class.erp-table__header-cell--pinned-right]="header.column.getIsPinned() === 'right'"
                        [class.erp-table__header-cell--pinned-left-last]="header.column.id === _lastLeftPinnedColumnId()"
                        [class.erp-table__header-cell--pinned-right-first]="header.column.id === _firstRightPinnedColumnId()"
                        [style.left.px]="header.column.getIsPinned() === 'left' ? header.column.getStart('left') : null"
                        [style.right.px]="header.column.getIsPinned() === 'right' ? header.column.getAfter('right') : null"
                      ></th>
                    }
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
                    [erpVirtualMeasure]="virtualizer()"
                    [index]="virtualRow.index"
                    [attr.data-index]="virtualRow.index"
                    class="erp-table__row border-b border-(--erp-table-border) hover:bg-(--erp-table-row-hover) transition-colors"
                    [class.bg-(--erp-table-row-selected)]="isRowSelected(row)"
                    (click)="onRowClickEvent(row.original, $event)"
                    (dblclick)="onRowDoubleClickEvent(row.original)"
                  >
                    @for (cell of _getOrderedCells(row); track cell.id) {
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
                    [class.bg-(--erp-table-row-selected)]="isRowSelected(row)"
                    (click)="onRowClickEvent(row.original, $event)"
                    (dblclick)="onRowDoubleClickEvent(row.original)"
                  >
                    @for (cell of _getOrderedCells(row); track cell.id) {
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
                    @for (footer of _getOrderedHeaders(footerGroup); track footer.id) {
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
      <!-- Toolbar -->
      <div class="erp-table-toolbar flex flex-col md:flex-row justify-between items-center border-t border-(--erp-table-border)">
        
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
              (visibilityChange)="onVisibilityChange($event)"
              (orderChange)="onColumnMenuDrop($event)"
            />
          }

          @if (_legendItems().length > 0) {
            <button
              tuiButton
              appearance="outline"
              size="s"
              iconStart="@tui.info"
              [tuiDropdown]="legendDropdown"
              [tuiDropdownOpen]="legendOpen()"
              (tuiDropdownOpenChange)="legendOpen.set($event)"
              class="ml-2"
            >
              {{ 'Legenda' }}
            </button>
            
            <ng-template #legendDropdown>
              <div class="p-4 bg-(--tui-background-elevated-1) border border-(--tui-border-normal) rounded-md shadow-lg min-w-[200px]">
                <h3 class="font-bold mb-3 text-sm">Legenda</h3>
                <div class="flex flex-col gap-3">
                  @for (item of _legendItems(); track $index) {
                    <div class="flex items-start gap-3">
                      <span 
                        tuiChip 
                        [size]="'s'" 
                        [tuiAppearance]="item.appearance || 'info'"
                        class="shrink-0"
                      >
                        {{ (item.shortText || item.text) | erpTranslate }}
                      </span>
                      <span class="text-sm text-(--tui-text-secondary) mt-0.5">
                        {{ (item.description || item.text) | erpTranslate }}
                      </span>
                    </div>
                  }
                </div>
              </div>
            </ng-template>
          }

          <button
            tuiButton
            appearance="outline"
            size="s"
            iconStart="@tui.settings"
            [tuiDropdown]="settingsDropdown"
            [tuiDropdownOpen]="settingsOpen()"
            (tuiDropdownOpenChange)="settingsOpen.set($event)"
            class="ml-2"
          >
          </button>
          
          <ng-template #settingsDropdown>
            <div class="p-4 max-w-sm bg-(--tui-background-elevated-1) border border-(--tui-border-normal) rounded-md shadow-lg">
              <h3 class="font-bold mb-3 text-sm">{{ 'shared.table.settings.title' | erpTranslate }}</h3>
              <div class="flex flex-col gap-3">
                <erp-switch 
                  [config]="{ size: 's', label: 'shared.table.settings.rowSelectionOnClick' }" 
                  [ngModel]="_rowSelectionOnClick()" 
                  (ngModelChange)="onRowSelectionOnClickChange($event)" 
                />
              </div>
            </div>
          </ng-template>

          <button
            tuiButton
            appearance="outline"
            size="s"
            iconStart="@tui.circle-help"
            [tuiDropdown]="helpDropdown"
            [tuiDropdownOpen]="helpOpen()"
            (tuiDropdownOpenChange)="helpOpen.set($event)"
            class="ml-2"
          >
            {{ 'shared.table.help.button' | erpTranslate }}
          </button>
          
          <ng-template #helpDropdown>
            <div class="p-4 max-w-sm bg-(--tui-background-elevated-1) border border-(--tui-border-normal) rounded-md shadow-lg">
              <h3 class="font-bold mb-2">{{ 'shared.table.help.title' | erpTranslate }}</h3>
              <ul class="text-sm space-y-2 list-disc pl-4 text-(--tui-text-secondary)">
                @if (config().enableMultiSort ?? true) {
                  <li><strong>{{ 'shared.table.help.multiSortTitle' | erpTranslate }}:</strong> {{ 'shared.table.help.multiSortDesc' | erpTranslate }}</li>
                }
                @if (config().enableColumnResizing ?? true) {
                  <li><strong>{{ 'shared.table.help.resizingTitle' | erpTranslate }}:</strong> {{ 'shared.table.help.resizingDesc' | erpTranslate }}</li>
                }
                @if (config().enableColumnVisibility ?? true) {
                  <li><strong>{{ 'shared.table.help.visibilityTitle' | erpTranslate }}:</strong> {{ 'shared.table.help.visibilityDesc' | erpTranslate }}</li>
                }
                @if (config().selectionMode === 'multi') {
                  <li><strong>{{ 'shared.table.help.multiSelectTitle' | erpTranslate }}:</strong> {{ 'shared.table.help.multiSelectDesc' | erpTranslate }}</li>
                }
                @if (config().selectionMode === 'multi' && _isServerMode()) {
                  <li><strong>{{ 'shared.table.help.serverSelectionTitle' | erpTranslate }}:</strong> {{ 'shared.table.help.serverSelectionDesc' | erpTranslate }}</li>
                }
              </ul>
            </div>
          </ng-template>
        </div>
      </div>



    </div>
  `,
})
export class ErpTableComponent<T> implements AfterViewInit {
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
  protected _skeletonRows = computed(() => this.config().skeletonRows ?? 5);

  protected helpOpen = signal(false);
  protected legendOpen = signal(false);
  protected settingsOpen = signal(false);
  protected _rowSelectionOnClick = signal<boolean>(false);

  protected _legendItems = computed(() => {
    const items = this.items();
    const leafCols = this._flattenLeafColumns();
    const manualLegend = unwrapSignal(this.config().legendItems) ?? [];
    
    const autoItems: ErpCellChip[] = [];
    
    for (const item of items) {
      for (const col of leafCols) {
        if (col.cellRichContent) {
          const val = col.accessorFn ? col.accessorFn(item) : (col.accessorKey ? (item as any)[col.accessorKey] : undefined);
          const rich = col.cellRichContent(val, item);
          
          if (rich.cellChips) {
            autoItems.push(...rich.cellChips);
          }
          if (rich.lines) {
            for (const line of rich.lines) {
              if (line.chips) {
                autoItems.push(...line.chips);
              }
            }
          }
        }
      }
    }
    
    const all = [...autoItems, ...manualLegend];
    const uniqueMap = new Map<string, ErpCellChip>();
    
    for (const chip of all) {
      const key = String(chip.text) + '_' + String(chip.appearance);
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, chip);
      }
    }
    
    return Array.from(uniqueMap.values());
  });

  // Pagination defaults
  protected _pageSizeOptions = computed(() => this.config().pageSizeOptions ?? [10, 20, 50, 100]);
  protected _enableColumnReordering = computed(() => this.config().enableColumnReordering ?? true);
  protected _enableColumnVisibility = computed(() => this.config().enableColumnVisibility ?? true);
  protected _hasFooter = computed(() => this._flattenLeafColumns().some(c => c.footer !== undefined));

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

  protected _getOrderedColumns() {
    return [
      ...this.table.getLeftVisibleLeafColumns(),
      ...this.table.getCenterVisibleLeafColumns(),
      ...this.table.getRightVisibleLeafColumns()
    ];
  }

  protected _getOrderedHeaders(headerGroup: any) {
    const left = headerGroup.headers.filter((h: any) => h.column.getIsPinned() === 'left');
    const center = headerGroup.headers.filter((h: any) => !h.column.getIsPinned());
    const right = headerGroup.headers.filter((h: any) => h.column.getIsPinned() === 'right');
    return [...left, ...center, ...right];
  }

  protected _getOrderedCells(row: any) {
    return [
      ...row.getLeftVisibleCells(),
      ...row.getCenterVisibleCells(),
      ...row.getRightVisibleCells()
    ];
  }

  // Signals for Table State
  protected _sorting = signal<SortingState>([]);
  private _pagination = signal<PaginationState>({ pageIndex: 0, pageSize: 20 });
  private _columnVisibility = signal<VisibilityState>({});
  private _columnOrder = signal<string[]>([]);
  private _columnSizing = signal<ColumnSizingState>({});
  private _rowSelection = signal<RowSelectionState>({});
  private _columnFilters = signal<ColumnFiltersState>([]);
  private _lastSelectedRowId = signal<string | null>(null);
  private _columnPinning = signal<ColumnPinningState>({ left: [], right: [] });
  protected _serverAllSelected = signal<boolean>(false);
  private _isInitialized = false;

  constructor() {
    // Initialize state from config if provided
    effect(() => {
      const config = this.config();
      const state = config.initialState;
      if (state && !this._isInitialized) {
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
          // Restore selection
          if (state.selection) {
            if (this._isServerMode() && state.selection.isAllSelected) {
              this._serverAllSelected.set(true);
            } else if (state.selection.selectedIds) {
              const rowSelection: RowSelectionState = {};
              state.selection.selectedIds.forEach(id => rowSelection[id] = true);
              this._rowSelection.set(rowSelection);
            }
          }
          if (state.rowSelectionOnClick !== undefined) {
            this._rowSelectionOnClick.set(state.rowSelectionOnClick);
          }
        });
      }
      
      // Default pagination if not set by state
      if (!state?.pagination && !this._isInitialized) {
        untracked(() => {
          const newSize = config.defaultPageSize ?? 20;
          if (this._pagination().pageSize !== newSize) {
            this._pagination.update(p => ({ ...p, pageSize: newSize }));
          }
        });
      }
      
      // Default column visibility & order
      untracked(() => {
        const currentVisibility = this._columnVisibility();
        const currentOrder = this._columnOrder();
        
        const newVisibility: VisibilityState = { ...currentVisibility };
        const newOrder: string[] = [];
        const newPinning: ColumnPinningState = { left: [], right: [] };
        
        if (this.config().selectionMode !== 'none') {
          if (!newOrder.includes('__selection')) newOrder.push('__selection');
          if (!this._rowSelectionOnClick()) {
            newPinning.left!.push('__selection');
          }
        }
        
        for (const colOrGroup of this.config().columns) {
          if (isColumnGroupDef(colOrGroup)) {
            // Grupa: iterujemy po liściach
            for (const col of colOrGroup.columns) {
              if (col.visible === false && currentVisibility[col.id] === undefined) {
                newVisibility[col.id] = false;
              }
              if (!newOrder.includes(col.id)) newOrder.push(col.id);
            }
          } else {
            const col = colOrGroup;
            if (col.visible === false && currentVisibility[col.id] === undefined) {
              newVisibility[col.id] = false;
            }
            if (!newOrder.includes(col.id)) newOrder.push(col.id);
          }
        }
        
        // Preserve any existing order that is still valid (existing columns)
        const finalOrder = currentOrder.length > 0 
          ? [...currentOrder.filter(id => newOrder.includes(id)), ...newOrder.filter(id => !currentOrder.includes(id))] 
          : newOrder;

        if (!state?.columnVisibility) this._columnVisibility.set(newVisibility);
        if (!state?.columnOrder) this._columnOrder.set(finalOrder);
        this._columnPinning.set(newPinning);
        
        this._isInitialized = true;
      });
    });
    
    // Dynamicznie przepinaj kolumnę zaznaczania
    effect(() => {
      const isRowSelection = this._rowSelectionOnClick();
      
      untracked(() => {
        if (!this._isInitialized) return;
        
        const currentPinning = this._columnPinning();
        const left = currentPinning.left ? [...currentPinning.left] : [];
        let changed = false;
        
        if (isRowSelection) {
          const idx = left.indexOf('__selection');
          if (idx !== -1) {
            left.splice(idx, 1);
            changed = true;
          }
        } else {
          if (this.config().selectionMode !== 'none' && !left.includes('__selection')) {
            left.push('__selection');
            changed = true;
          }
        }
        
        if (changed) {
          this._columnPinning.set({ ...currentPinning, left });
        }
      });
    });

    // Effect to emit state changes (triggers data fetching in host components)
    effect(() => {
      // Re-run effect only on pagination, sorting, or column config changes
      const sorting = this._sorting().map(s => ({ columnId: s.id, direction: (s.desc ? 'desc' : 'asc') as 'asc' | 'desc' }));
      const pagination = this._pagination();
      const columnVisibility = this._columnVisibility();
      const columnOrder = this._columnOrder();
      const columnSizing = this._columnSizing();
      const rowSelectionOnClick = this._rowSelectionOnClick();

      untracked(() => {
        const filters = unwrapSignal(this.config().filters) ?? {};
        const state: ErpTableState = {
          sorting,
          pagination,
          filters,
          columnVisibility,
          columnOrder,
          columnSizing,
          selection: {
            isAllSelected: this._isServerMode() ? this._serverAllSelected() : this.table.getIsAllRowsSelected(),
            selectedIds: Object.keys(this._rowSelection()).filter(k => this._rowSelection()[k]),
            filters: (this._isServerMode() && this._serverAllSelected()) ? filters : undefined
          },
          rowSelectionOnClick: this._rowSelectionOnClick(),
        };
        this.config().onStateChange?.(state);
      });
    });
  }

  private _autoSized = false;
  private _resizeObserver: ResizeObserver | null = null;
  private destroyRef = inject(DestroyRef);

  ngAfterViewInit() {
    const el = this.scrollElement()?.nativeElement;
    if (!el) return;

    const config = this.config();
    if (config.initialState?.columnSizing && Object.keys(config.initialState.columnSizing).length > 0) {
      this._autoSized = true;
      return;
    }

    this._resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0 && !this._autoSized) {
          this._autoSized = true;
          this.calculateAutoColumnSizing(width);
          this._resizeObserver?.disconnect();
          break;
        }
      }
    });

    this._resizeObserver.observe(el);
    this.destroyRef.onDestroy(() => this._resizeObserver?.disconnect());
  }

  private calculateAutoColumnSizing(totalWidth: number) {
    const visibility = this._columnVisibility();
    const leafCols = this._flattenLeafColumns();
    const config = this.config();
    
    let fixedWidth = 0;
    const autoCols: ErpColumnDef<any>[] = [];
    
    if (config.selectionMode !== 'none') {
      fixedWidth += 48; // from tanstack selection column definition
    }
    
    for (const col of leafCols) {
      const isVisible = visibility[col.id] !== false;
      if (!isVisible) continue;
      
      if (col.size !== undefined) {
        fixedWidth += col.size;
      } else {
        autoCols.push(col);
        fixedWidth += (col.minSize ?? 80);
      }
    }
    
    const remainingWidth = totalWidth - fixedWidth;
    
    if (remainingWidth > 0 && autoCols.length > 0) {
      const extraPerCol = Math.floor(remainingWidth / autoCols.length);
      const newSizing = { ...this._columnSizing() };
      
      for (let i = 0; i < autoCols.length; i++) {
        const col = autoCols[i];
        let newWidth = (col.minSize ?? 80) + extraPerCol;
        if (i === autoCols.length - 1) {
           newWidth += remainingWidth % autoCols.length; 
        }
        newSizing[col.id] = newWidth;
      }
      
      this._columnSizing.set(newSizing);
    }
  }



  private _emitSelectionChange() {
    const isServer = this._isServerMode();
    const idAccessor = this.config().rowIdAccessor;
    
    if (isServer && this._serverAllSelected()) {
      this.config().onSelectionChange?.({
        mode: 'server',
        isAllSelected: true,
        selectedItems: [],
        selectedIds: [],
        filters: unwrapSignal(this.config().filters) ?? {}
      });
      return;
    }

    const newVal = this._rowSelection();
    const selectedIds = Object.keys(newVal).filter(k => newVal[k]);
    const items = this.items();
    let selectedItems: T[] = [];
    if (idAccessor) {
      const selectedSet = new Set(selectedIds);
      selectedItems = items.filter(item => selectedSet.has(idAccessor(item)));
    } else {
      selectedItems = selectedIds.map(id => items[parseInt(id, 10)]).filter(Boolean);
    }
    
    this.config().onSelectionChange?.({
      mode: isServer ? 'server' : 'client',
      isAllSelected: isServer ? false : this.table.getIsAllRowsSelected(),
      selectedItems,
      selectedIds,
    });
  }

  isRowSelected(row: Row<T>): boolean {
    if (this._isServerMode() && this._serverAllSelected()) {
      return true;
    }
    return row.getIsSelected();
  }

  private _handleRowSelection(row: Row<T>, checked: boolean, shiftKey: boolean) {
    if (shiftKey && this._lastSelectedRowId()) {
      const rows = this.table().getRowModel().rows;
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
        this.table().setRowSelection(newSelection);
      }
    } else {
      row.toggleSelected(checked);
    }
    this._lastSelectedRowId.set(row.id);
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
                checked: this._isServerMode() ? this._serverAllSelected() : table.getIsAllRowsSelected(),
                indeterminate: this._isServerMode() ? false : (table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()),
                selectionMode: config.selectionMode,
              },
              outputs: {
                changed: ({ checked }: { checked: boolean }) => {
                  if (this._isServerMode()) {
                    this._serverAllSelected.set(checked);
                    if (!checked) {
                      this._rowSelection.set({});
                    }
                    this._emitSelectionChange();
                  } else {
                    table.toggleAllRowsSelected(checked);
                  }
                }
              }
            });
          }
          return '';
        },
        cell: ({ row, table }) => {
          return flexRenderComponent(ErpTableSelectionCell, {
            inputs: {
              checked: (this._isServerMode() && this._serverAllSelected()) ? true : row.getIsSelected(),
              disabled: (this._isServerMode() && this._serverAllSelected()) || !row.getCanSelect(),
              selectionMode: config.selectionMode,
            },
            outputs: {
              changed: ({ checked, shiftKey }: { checked: boolean, shiftKey: boolean }) => {
                this._handleRowSelection(row, checked, shiftKey);
              }
            }
          });
        },
        size: 48,
        minSize: 48,
        maxSize: 48,
        enableSorting: false,
        enableResizing: false,
        meta: { 
          pin: 'left',
          align: 'center',
          cellClass: '!px-0',
          headerClass: '!px-0'
        },
      });
    }

    // Data Columns (flat + grouped)
    for (const colOrGroup of config.columns) {
      if (isColumnGroupDef(colOrGroup)) {
        // Column Group — parent header with nested children
        cols.push({
          id: colOrGroup.id,
          header: () => unwrapSignal(colOrGroup.header),
          columns: colOrGroup.columns.map(col => this._mapErpColumnToTanstack(col)),
        });
      } else {
        cols.push(this._mapErpColumnToTanstack(colOrGroup));
      }
    }

    return cols;
  });

  /**
   * Mapuje pojedynczą definicję kolumny ERP na definicję TanStack.
   * Wydzielone jako metoda, aby można było użyć zarówno dla flat, jak i grouped columns.
   */
  private _mapErpColumnToTanstack(col: ErpColumnDef<any>): ColumnDef<T> {
    return {
      id: col.id,
      accessorKey: col.accessorKey as string,
      accessorFn: col.accessorFn,
      header: () => unwrapSignal(col.header),
      footer: col.footer ? () => unwrapSignal(col.footer) : undefined,
      cell: col.cell
        ? ({ row }) => flexRenderComponent(col.cell!, { inputs: { row: row.original, ...col.cellInputs } })
        : col.cellRichContent
        ? ({ getValue, row }) => flexRenderComponent(ErpChipCellComponent, {
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
        align: col.align, 
        subHeader: col.subHeader ? unwrapSignal(col.subHeader) : undefined,
        cellClass: col.cellRichContent 
          ? (col.cellClass ? col.cellClass + ' erp-table__cell--rich-content' : 'erp-table__cell--rich-content') 
          : col.cellClass 
      },
    };
  }

  /**
   * Wydobywa wszystkie kolumny liściowe (leaf columns) z konfiguracji,
   * w tym kolumny zagnieżdżone wewnątrz grup.
   */
  private _flattenLeafColumns(): ErpColumnDef<any>[] {
    const result: ErpColumnDef<any>[] = [];
    for (const colOrGroup of this.config().columns) {
      if (isColumnGroupDef(colOrGroup)) {
        result.push(...colOrGroup.columns);
      } else {
        result.push(colOrGroup);
      }
    }
    return result;
  }

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
        this._emitSelectionChange();
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

  protected _columnMenuInfo = computed(() => {
    const leafCols = this._flattenLeafColumns();
    const order = this._columnOrder();
    
    const mapColumn = (colOrGroup: ErpColumnDef<any> | ErpColumnGroupDef<any>): any => {
      if (colOrGroup.id === '__selection') return null;
      
      if (isColumnGroupDef(colOrGroup)) {
        const children = colOrGroup.columns
          .map(c => mapColumn(c))
          .filter(c => c !== null);
          
        if (children.length === 0) return null;
        
        children.sort((a, b) => {
          const aIdx = order.indexOf(a.id);
          const bIdx = order.indexOf(b.id);
          if (aIdx === -1) return 1;
          if (bIdx === -1) return -1;
          return aIdx - bIdx;
        });
        
        const visible = children.some((c: any) => c.visible);
        
        return {
          id: colOrGroup.id,
          header: unwrapSignal(colOrGroup.header) as string,
          visible,
          disableHiding: children.every((c: any) => c.disableHiding),
          isGroup: true,
          children
        };
      } else {
        const tCol = this.table().getColumn(colOrGroup.id);
        if (!tCol) return null;
        
        const originalCol = leafCols.find(c => c.id === colOrGroup.id);
        const headerText = originalCol ? unwrapSignal(originalCol.header) : colOrGroup.id;
        
        return {
          id: colOrGroup.id,
          header: headerText as string,
          visible: tCol.getIsVisible(),
          disableHiding: !tCol.getCanHide(),
          isGroup: false
        };
      }
    };

    const items = this.config().columns
      .map(c => mapColumn(c))
      .filter(c => c !== null);
      
    items.sort((a, b) => {
      const aId = a.isGroup ? a.children[0].id : a.id;
      const bId = b.isGroup ? b.children[0].id : b.id;
      const aIdx = order.indexOf(aId);
      const bIdx = order.indexOf(bId);
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
    
    return items;
  });

  // Handlers
  protected onPaginationChange(event: ErpPaginationState) {
    this.table().setPagination(event);
  }

  protected onVisibilityChange(changes: { id: string; visible: boolean }[]) {
    const visibility = { ...this.table().getState().columnVisibility };
    for (const change of changes) {
      visibility[change.id] = change.visible;
    }
    this.table().setColumnVisibility(visibility);
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

  protected onRowSelectionOnClickChange(value: boolean) {
    this._rowSelectionOnClick.set(value);
  }

  protected onRowClickEvent(rowOriginal: T, event: MouseEvent) {
    this.config().onRowClick?.(rowOriginal);
    if (this._rowSelectionOnClick() && this.config().selectionMode !== 'none') {
      if (this._isServerMode() && this._serverAllSelected()) return;
      const tanstackRow = this.table().getRowModel().rows.find(r => r.original === rowOriginal);
      if (tanstackRow && tanstackRow.getCanSelect()) {
        const checked = !tanstackRow.getIsSelected();
        this._handleRowSelection(tanstackRow, checked, event.shiftKey);
      }
    }
  }

  protected onRowDoubleClickEvent(row: T) {
    this.config().onRowDoubleClick?.(row);
  }

  public clearSelection(): void {
    if (this._isServerMode()) {
      this._serverAllSelected.set(false);
    }
    this._rowSelection.set({});
    this.table().setRowSelection({});
    this._emitSelectionChange();
  }
}
