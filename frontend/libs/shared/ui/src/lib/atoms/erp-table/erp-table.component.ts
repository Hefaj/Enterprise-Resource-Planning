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
import { ErpUserPreferencesService, ErpPreferencesType } from '@erp/shared/data-access';

import {
  ErpTableConfig,
  ErpTableState,
  ErpPaginationState,
  ErpCellChip,
  ErpColumnDef,
  ErpColumnGroupDef,
  isColumnGroupDef,
  ErpSelectionState,
  ErpGroupedRowsConfig,
  ErpGroupRowAction,
} from './erp-table.types';
import { erpOrderIdsByPosition } from './erp-selection.utils';
import { ErpSizingColumn, erpFitColumnWidths, erpRescaleColumnWidths } from './erp-column-sizing';
import { ErpTablePaginationComponent } from './erp-table-pagination.component';
import { ErpTableColumnMenuComponent } from './erp-table-column-menu.component';
import { unwrapSignal, Translatable } from '../../base/erp-signal-utils';
import { ErpTranslatePipe } from '../../base/erp-translate.pipe';
import { ErpChipCellComponent } from './erp-chip-cell.component';
import { ErpSwitchComponent } from '../../form/erp-switch/erp-switch.component';

/**
 * Wiersz do wyrenderowania w jednej, wspólnej wirtualizowanej liście —
 * albo sztuczny wiersz-rodzic grupy (`group`), albo zwykły wiersz danych
 * przechodzący przez standardowy mechanizm kolumn (`leaf`).
 */
type FlatDisplayRow<T> =
  | { kind: 'group'; group: any; key: string; expanded: boolean; totalCount: number; selectedCount: number; loading: boolean }
  | { kind: 'leaf'; row: Row<T>; group?: any; groupKey?: string };

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

    // Natywny radio nie emituje zmiany po kliknięciu w już zaznaczoną opcję —
    // bez tego pojedyncze zaznaczenie nie dałoby się odznaczyć.
    if (this.selectionMode() === 'single' && this.checked()) {
      event.preventDefault();
      this.changed.emit({ checked: false, shiftKey: event.shiftKey });
      this._lastShiftKey = false;
    }
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
    ErpTableSelectionCell,
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
          (mousedown)="onTableMouseDown($event)"
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
                              (mousedown)="onColumnResizeStart(header, $event)"
                              (touchstart)="onColumnResizeStart(header, $event)"
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
              @if (_flatDisplayRows().length === 0 && !loading()) {
                <tr>
                  <td [colSpan]="table.getVisibleFlatColumns().length" class="p-8 text-center text-(--erp-table-text-secondary)">
                    {{ _emptyMessage() | erpTranslate }}
                  </td>
                </tr>
              }
              
              @if (loading() && _skeletonRows() > 0 && _flatDisplayRows().length === 0) {
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

              <!--
                Definicje wierszy wyciągnięte do szablonów, bo używa ich i tryb wirtualny,
                i zwykły — grupowanie (setGroupedRows) działa niezależnie od wirtualizacji.
                Dyrektywa erpVirtualMeasure z pustym virtualizerem nie robi nic, więc ten sam
                wiersz obsługuje oba tryby.
              -->
              <ng-template #groupRowTpl let-flatRow let-virtualizer="virtualizer" let-index="index">
                <!-- Sztuczny wiersz-rodzic grupy — bez związku z kolumnami danych -->
                <tr
                  [erpVirtualMeasure]="virtualizer"
                  [index]="index"
                  [attr.data-index]="index"
                  class="erp-table__group-row"
                  (click)="toggleGroupExpanded(flatRow.key)"
                >
                  <td [colSpan]="table.getVisibleFlatColumns().length" class="erp-table__group-cell">
                    <div class="erp-table__group-content">
                      @if (config().selectionMode !== 'none') {
                        <div class="erp-table__group-checkbox" (click)="$event.stopPropagation()">
                          <erp-table-selection-cell
                            [checked]="flatRow.totalCount > 0 && flatRow.selectedCount === flatRow.totalCount"
                            [indeterminate]="flatRow.selectedCount > 0 && flatRow.selectedCount < flatRow.totalCount"
                            [selectionMode]="'multi'"
                            (changed)="toggleGroupSelection(flatRow.key, $event.checked, $event.shiftKey)"
                          />
                        </div>
                      }

                      <tui-icon
                        icon="@tui.chevron-right"
                        class="erp-table__group-chevron"
                        [class.erp-table__group-chevron--expanded]="flatRow.expanded"
                      />

                      @if (_groupIcon(flatRow.group); as groupIcon) {
                        <tui-icon [icon]="groupIcon" class="erp-table__group-icon" />
                      }

                      <div class="erp-table__group-titles">
                        <span class="erp-table__group-title">{{ _groupTitle(flatRow.group) | erpTranslate }}</span>
                        @if (_groupSubtitle(flatRow.group); as groupSubtitle) {
                          <span class="erp-table__group-subtitle">{{ groupSubtitle | erpTranslate }}</span>
                        }
                      </div>

                      @if (flatRow.loading) {
                        <tui-icon icon="@tui.loader-circle" class="erp-table__group-spinner" />
                      } @else if (flatRow.totalCount > 0) {
                        <span class="erp-table__group-count">{{ flatRow.totalCount }}</span>
                      }

                      @if (_groupActions().length > 0) {
                        <div class="erp-table__group-actions" (click)="$event.stopPropagation()">
                          @for (action of _groupActions(); track action.label) {
                            <button
                              tuiButton
                              type="button"
                              appearance="flat"
                              size="xs"
                              [disabled]="_isGroupActionDisabled(action, flatRow.group)"
                              (click)="onGroupActionClick(action, flatRow.group)"
                            >
                              @if (action.icon) {
                                <tui-icon [icon]="action.icon" />
                              }
                              {{ action.label | erpTranslate }}
                            </button>
                          }
                        </div>
                      }
                    </div>
                  </td>
                </tr>
              </ng-template>

              <ng-template #leafRowTpl let-row let-virtualizer="virtualizer" let-index="index">
                <tr
                  [erpVirtualMeasure]="virtualizer"
                  [index]="index"
                  [attr.data-index]="index"
                  class="erp-table__row border-b border-(--erp-table-border) hover:bg-(--erp-table-row-hover) transition-colors"
                  [class.bg-(--erp-table-row-selected)]="isRowSelected(row)"
                  (click)="onRowClickEvent(row.original, $event)"
                  (dblclick)="onRowDoubleClickEvent(row.original)"
                  (contextmenu)="onRowContextMenuEvent(row.original, $event)"
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
              </ng-template>

              @if (_enableVirtualScroll()) {
                <!-- Virtual Padding Top -->
                @if (virtualizer().getVirtualItems().length > 0) {
                  <tr>
                    <td [colSpan]="table.getVisibleFlatColumns().length" [style.height.px]="virtualizer().getVirtualItems()[0].start"></td>
                  </tr>
                }

                @for (virtualRow of virtualizer().getVirtualItems(); track virtualRow.key) {
                  @let flatRow = _flatDisplayRows()[virtualRow.index];
                  @if (flatRow.kind === 'group') {
                    <ng-container
                      *ngTemplateOutlet="groupRowTpl; context: { $implicit: flatRow, virtualizer: virtualizer(), index: virtualRow.index }"
                    ></ng-container>
                  } @else {
                    <ng-container
                      *ngTemplateOutlet="leafRowTpl; context: { $implicit: flatRow.row, virtualizer: virtualizer(), index: virtualRow.index }"
                    ></ng-container>
                  }
                }

                <!-- Virtual Padding Bottom -->
                @if (virtualizer().getVirtualItems().length > 0) {
                  <tr>
                    <td [colSpan]="table.getVisibleFlatColumns().length" [style.height.px]="virtualizer().getTotalSize() - virtualizer().getVirtualItems()[virtualizer().getVirtualItems().length - 1].end"></td>
                  </tr>
                }
              } @else if (_isGroupedMode()) {
                <!-- Zwykła pętla z grupami — te same wiersze, bez wirtualizera -->
                @for (flatRow of _flatDisplayRows(); track _flatRowKey(flatRow); let i = $index) {
                  @if (flatRow.kind === 'group') {
                    <ng-container
                      *ngTemplateOutlet="groupRowTpl; context: { $implicit: flatRow, virtualizer: null, index: i }"
                    ></ng-container>
                  } @else {
                    <ng-container
                      *ngTemplateOutlet="leafRowTpl; context: { $implicit: flatRow.row, virtualizer: null, index: i }"
                    ></ng-container>
                  }
                }
              } @else {
                <!-- Zwykła pętla -->
                @for (row of table.getRowModel().rows; track row.id; let i = $index) {
                  <ng-container
                    *ngTemplateOutlet="leafRowTpl; context: { $implicit: row, virtualizer: null, index: i }"
                  ></ng-container>
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
        
        @if (!_isGroupedMode()) {
          <erp-table-pagination
            class="flex-1 w-full"
            [pageIndex]="table.getState().pagination.pageIndex"
            [pageSize]="table.getState().pagination.pageSize"
            [totalItems]="itemCount() || table.getPrePaginationRowModel().rows.length"
            [pageSizeOptions]="_pageSizeOptions()"
            (pageChange)="onPaginationChange($event)"
          />
        } @else {
          <div class="flex-1 w-full"></div>
        }

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
                <erp-switch 
                  [config]="{ size: 's', label: 'shared.table.settings.rightClickSelection' }" 
                  [ngModel]="_rightClickSelection()" 
                  (ngModelChange)="onRightClickSelectionChange($event)" 
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
  protected _rightClickSelection = signal<boolean>(false);

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

  // ── Grouped rows (sztuczne wiersze-rodzice + jedna wspólna wirtualizacja) ──
  protected _groupedRowsConfig = computed<ErpGroupedRowsConfig<any, T> | undefined>(() => this.config().groupedRows);
  protected _isGroupedMode = computed(() => !!this._groupedRowsConfig());
  protected _groups = computed<any[]>(() => unwrapSignal(this._groupedRowsConfig()?.groups) ?? []);
  protected _groupActions = computed<ErpGroupRowAction<any>[]>(() => this._groupedRowsConfig()?.actions ?? []);

  private readonly _expandedGroups = signal<Set<string>>(new Set());
  private readonly _loadingGroups = signal<Set<string>>(new Set());
  private readonly _seenGroupKeys = new Set<string>();
  private readonly _requestedGroupLoads = new Set<string>();

  /** Wiersze danych (dzieci) pogrupowane po kluczu grupy, z zachowaniem bieżącego sortowania. */
  protected _childrenByGroup = computed(() => {
    const cfg = this._groupedRowsConfig();
    const map = new Map<string, Row<T>[]>();
    if (!cfg) return map;
    for (const row of this.table().getRowModel().rows) {
      const key = cfg.getRowGroupKey(row.original);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return map;
  });

  /**
   * Logiczna, pełna kolejność wierszy danych (bez nagłówków grup), używana wyłącznie
   * do liczenia zakresów przy zaznaczaniu z Shift — niezależna od tego, czy dana grupa
   * jest akurat zwinięta czy rozwinięta (zwinięta grupa nadal "zajmuje miejsce" w zakresie).
   * W trybie bez grupowania to po prostu kolejność wierszy tabeli.
   */
  protected _logicalRowOrder = computed<Row<T>[]>(() => {
    const cfg = this._groupedRowsConfig();
    if (!cfg) {
      return this.table().getRowModel().rows;
    }

    const childrenByGroup = this._childrenByGroup();
    const result: Row<T>[] = [];
    for (const group of this._groups()) {
      const key = cfg.getGroupKey(group);
      result.push(...(childrenByGroup.get(key) ?? []));
    }
    return result;
  });

  /**
   * Spłaszczona lista wierszy do wyrenderowania w jednej wirtualizowanej liście —
   * w trybie zwykłym to po prostu wiersze tabeli; w trybie grupowanym to
   * wiersz-grupa + (jeśli rozwinięta) jej dzieci, dla każdej grupy po kolei.
   */
  protected _flatDisplayRows = computed<FlatDisplayRow<T>[]>(() => {
    const cfg = this._groupedRowsConfig();
    if (!cfg) {
      return this.table().getRowModel().rows.map(row => ({ kind: 'leaf' as const, row }));
    }

    const childrenByGroup = this._childrenByGroup();
    const expanded = this._expandedGroups();
    const loadingGroups = this._loadingGroups();
    const result: FlatDisplayRow<T>[] = [];

    for (const group of this._groups()) {
      const key = cfg.getGroupKey(group);
      const children = childrenByGroup.get(key) ?? [];
      const isExpanded = expanded.has(key);
      const selectedCount = children.filter(r => r.getIsSelected()).length;

      result.push({
        kind: 'group',
        group,
        key,
        expanded: isExpanded,
        totalCount: children.length,
        selectedCount,
        loading: loadingGroups.has(key) || (cfg.isGroupLoading?.(group) ?? false),
      });

      if (isExpanded) {
        for (const row of children) {
          result.push({ kind: 'leaf', row, group, groupKey: key });
        }
      }
    }

    return result;
  });

  /** Klucz śledzenia wiersza w płaskiej liście (grupa albo wiersz danych w obrębie grupy). */
  protected _flatRowKey(flatRow: FlatDisplayRow<T>): string {
    return flatRow.kind === 'group' ? `g:${flatRow.key}` : `r:${flatRow.groupKey ?? ''}:${flatRow.row.id}`;
  }

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
  /**
   * Szerokości kolumn jako źródło prawdy: nadpisania z ręcznych zmian i z odtworzonych
   * preferencji (brak wpisu = `size` z definicji kolumny). Do renderu i do TanStacka idzie
   * `_fittedSizing()` — te same wartości po rozdzieleniu wolnej przestrzeni.
   */
  private _columnSizing = signal<ColumnSizingState>({});
  private _rowSelection = signal<RowSelectionState>({});
  private _columnFilters = signal<ColumnFiltersState>([]);
  private _lastSelectedRowId = signal<string | null>(null);
  private _columnPinning = signal<ColumnPinningState>({ left: [], right: [] });
  protected _serverAllSelected = signal<boolean>(false);
  private _isInitialized = false;

  private readonly preferencesService = inject(ErpUserPreferencesService);
  private _saveStateTimeout: any;

  constructor() {
    // Initialize state from config if provided (jawny initialState ma priorytet nad zapisanymi preferencjami)
    effect(() => {
      const config = this.config();
      const key = config.stateKey;
      const state: Partial<ErpTableState> | undefined = config.initialState
        ?? (key ? untracked(() => this.preferencesService.getState(ErpPreferencesType.Table, key)) : undefined);
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
            this._pendingSizingRescale = state.columnSizingViewportWidth ?? null;
          }
          if (state.manuallyResizedColumns) {
            this._manuallyResized.set(new Set(state.manuallyResizedColumns));
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
          if (state.rightClickSelection !== undefined) {
            this._rightClickSelection.set(state.rightClickSelection);
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
        // Zawsze `finalOrder`, nigdy surowy `state.columnOrder` — `finalOrder` już go w sobie
        // niesie (przez `currentOrder`, ustawiony z zapisanego stanu wyżej) i dokleja do niego
        // kolumny, których zapisany stan jeszcze nie znał (nowe kolumny, `__selection` po
        // włączeniu zaznaczania). Pominięcie tego merge'a dla zapisanego stanu zostawiało takie
        // kolumny całkiem poza `columnOrder` — TanStack dokleja je wtedy na sam koniec listy
        // widocznych kolumn, więc np. kolumna zaznaczania renderowała się jako ostatnia zamiast
        // pierwsza, mimo poprawnego pinningu (patrz identity-users-table, docs/frontend/pages.md §10).
        this._columnOrder.set(finalOrder);
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

    // Zmiana filtrów = inny zbiór wierszy. Zaznaczenie opisywało poprzedni (listę identyfikatorów
    // albo sam filtr przy „Zaznacz wszystko"), więc zostawienie go dawałoby akcje masowe celujące
    // w pozycje, których użytkownik już nie widzi. Sortowanie czyścimy w `onSortingChange`.
    effect(() => {
      const filtersToken = JSON.stringify(unwrapSignal(this.config().filters) ?? {});

      untracked(() => {
        if (this._lastFiltersToken === filtersToken) return;
        const isFirstRun = this._lastFiltersToken === null;
        this._lastFiltersToken = filtersToken;
        if (isFirstRun) return; // pierwsze przypisanie filtrów to nie zmiana

        this._resetSelectionOnDataShapeChange();
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
      const rightClickSelection = this._rightClickSelection();

      untracked(() => {
        const filters = unwrapSignal(this.config().filters) ?? {};
        const state: ErpTableState = {
          sorting,
          pagination,
          filters,
          columnVisibility,
          columnOrder,
          columnSizing,
          columnSizingViewportWidth: this._viewportWidth() || undefined,
          manuallyResizedColumns: [...this._manuallyResized()],
          selection: {
            isAllSelected: this._isServerMode() ? this._serverAllSelected() : this.table.getIsAllRowsSelected(),
            selectedIds: this._orderedSelectedIds(),
            filters: (this._isServerMode() && this._serverAllSelected()) ? filters : undefined
          },
          rowSelectionOnClick: this._rowSelectionOnClick(),
          rightClickSelection: this._rightClickSelection(),
        };
        this.config().onStateChange?.(state);

        const key = this.config().stateKey;
        if (key) {
          clearTimeout(this._saveStateTimeout);
          this._saveStateTimeout = setTimeout(() => {
            const stateToSave: ErpTableState = {
              ...state,
              // Zaznaczenie jest ulotne — nie zapisujemy go w preferencjach usera.
              selection: { isAllSelected: false, selectedIds: [], filters: {} },
            };
            this.preferencesService.saveState(ErpPreferencesType.Table, key, stateToSave);
          }, 400);
        }
      });
    });

    // Grouped rows: domyślne rozwinięcie nowo napotkanych grup (raz na grupę — nie nadpisuje ręcznego collapse).
    effect(() => {
      const cfg = this._groupedRowsConfig();
      if (!cfg || cfg.defaultExpanded === false) return;
      const groups = this._groups();

      untracked(() => {
        const next = new Set(this._expandedGroups());
        let changed = false;
        for (const group of groups) {
          const key = cfg.getGroupKey(group);
          if (!this._seenGroupKeys.has(key)) {
            this._seenGroupKeys.add(key);
            next.add(key);
            changed = true;
          }
        }
        if (changed) this._expandedGroups.set(next);
      });
    });

    // Grouped rows: dociąganie dzieci grupy dopiero gdy jej wiersz stanie się widoczny w wirtualizerze,
    // oraz — niezależnie — doładowywanie kolejnych porcji danych dla już istniejących wierszy w miarę
    // scrollowania w głąb dużej grupy (onVisibleRowsChange).
    effect(() => {
      const cfg = this._groupedRowsConfig();
      if (!cfg) return;
      const visibleItems = this.virtualizer().getVirtualItems();
      const flatRows = this._flatDisplayRows();

      untracked(() => {
        const visibleRowsByGroup = cfg.onVisibleRowsChange
          ? new Map<string, { group: any; rows: T[] }>()
          : null;

        for (const item of visibleItems) {
          const flatRow = flatRows[item.index];
          if (!flatRow) continue;

          if (flatRow.kind === 'group') {
            if (cfg.loadChildren) {
              this._ensureGroupChildrenLoaded(flatRow);
            }
          } else if (visibleRowsByGroup && flatRow.groupKey !== undefined) {
            let entry = visibleRowsByGroup.get(flatRow.groupKey);
            if (!entry) {
              entry = { group: flatRow.group, rows: [] };
              visibleRowsByGroup.set(flatRow.groupKey, entry);
            }
            entry.rows.push(flatRow.row.original);
          }
        }

        if (visibleRowsByGroup) {
          for (const { group, rows } of visibleRowsByGroup.values()) {
            cfg.onVisibleRowsChange!(group, rows);
          }
        }
      });
    });

    this.destroyRef.onDestroy(() => clearTimeout(this._saveStateTimeout));
  }

  // ── Dopasowanie szerokości kolumn do szerokości tabeli ─────────────────────────────────
  //
  // `_columnSizing` to JEDYNE źródło prawdy: nadpisania szerokości z ręcznych zmian użytkownika
  // i z odtworzonych preferencji (brak wpisu = `size` z definicji kolumny). `_fittedSizing` jest
  // wartością POCHODNĄ — tymi samymi szerokościami po rozdzieleniu wolnej przestrzeni — i to ona
  // trafia do TanStacka, żeby `getSize()`, przypięte kolumny i wirtualizer liczyły na tych samych
  // liczbach, które faktycznie widać na ekranie. Algorytm: `erp-column-sizing.ts`.

  private static readonly DEFAULT_COLUMN_SIZE = 150;
  private static readonly DEFAULT_MIN_COLUMN_SIZE = 80;
  private static readonly SELECTION_COLUMN_SIZE = 48;

  /** Szerokość obszaru roboczego tabeli (content box kontenera scrolla). 0 do pierwszego pomiaru. */
  private readonly _viewportWidth = signal(0);

  /** Kolumny, których szerokość użytkownik ustawił ręcznie — wyłączone z rozdziału wolnej przestrzeni. */
  private readonly _manuallyResized = signal<Set<string>>(new Set());

  /**
   * Szerokość obszaru tabeli zapamiętana razem z odtworzonym `columnSizing` — do jednorazowej
   * normalizacji układu zbudowanego na innej rozdzielczości. `null` = nic do znormalizowania.
   */
  private _pendingSizingRescale: number | null = null;

  private _resizeObserver: ResizeObserver | null = null;
  private destroyRef = inject(DestroyRef);

  /**
   * Widoczne kolumny liściowe sprowadzone do parametrów szerokości — łącznie z kolumną
   * zaznaczania. `base` to szerokość z definicji, bez ręcznych nadpisań.
   */
  private readonly _sizingColumns = computed<ErpSizingColumn[]>(() => {
    const visibility = this._columnVisibility();
    const columns: ErpSizingColumn[] = [];

    if (this.config().selectionMode !== 'none') {
      const size = ErpTableComponent.SELECTION_COLUMN_SIZE;
      columns.push({ id: '__selection', base: size, min: size, max: size, grow: 0 });
    }

    for (const col of this._flattenLeafColumns()) {
      if (visibility[col.id] === false) continue;
      columns.push({
        id: col.id,
        base: col.size ?? ErpTableComponent.DEFAULT_COLUMN_SIZE,
        min: col.minSize ?? ErpTableComponent.DEFAULT_MIN_COLUMN_SIZE,
        max: col.maxSize ?? Number.POSITIVE_INFINITY,
        grow: col.grow ?? 1,
      });
    }

    return columns;
  });

  /** `_sizingColumns` z bazą podmienioną na ręczne ustawienia użytkownika, jeśli takie są. */
  private readonly _effectiveSizingColumns = computed<ErpSizingColumn[]>(() => {
    const declared = this._columnSizing();
    return this._sizingColumns().map(col => ({ ...col, base: declared[col.id] ?? col.base }));
  });

  protected readonly _fittedSizing = computed<ColumnSizingState>(() => {
    const sizes = erpFitColumnWidths(this._effectiveSizingColumns(), {
      viewport: this._viewportWidth(),
      manuallyResized: this._manuallyResized(),
    });

    // Zaczynamy od `_columnSizing`, żeby ręczne szerokości kolumn aktualnie ukrytych nie przepadły
    // po ich ponownym pokazaniu — TanStack i tak czyta tylko wpisy kolumn widocznych.
    const result: ColumnSizingState = { ...this._columnSizing() };
    for (const [id, size] of sizes) result[id] = size;
    return result;
  });

  ngAfterViewInit() {
    const el = this.scrollElement()?.nativeElement;
    if (!el) return;

    // Obserwator zostaje podłączony na stałe — dopasowanie ma reagować na każdą zmianę layoutu
    // (rozmiar okna, otwarcie panelu bocznego, zwinięcie menu), a nie tylko na pierwszy render.
    this._resizeObserver = new ResizeObserver(entries => {
      const width = Math.floor(entries[0]?.contentRect.width ?? 0);
      if (width <= 0 || width === this._viewportWidth()) return;
      this._applyPendingSizingRescale(width);
      this._viewportWidth.set(width);
    });

    this._resizeObserver.observe(el);
    this.destroyRef.onDestroy(() => this._resizeObserver?.disconnect());
  }

  /** Jednorazowo normalizuje szerokości odtworzone z preferencji do bieżącej rozdzielczości. */
  private _applyPendingSizingRescale(viewportWidth: number): void {
    const savedViewport = this._pendingSizingRescale;
    if (savedViewport === null) return;
    this._pendingSizingRescale = null;

    const rescaled = erpRescaleColumnWidths(
      this._sizingColumns(),
      this._columnSizing(),
      savedViewport,
      viewportWidth,
    );
    if (rescaled) this._columnSizing.set(rescaled);
  }

  /**
   * Start ręcznej zmiany szerokości. Zanim oddamy zdarzenie TanStackowi, materializujemy
   * aktualnie wyrenderowane szerokości jako nową bazę — dzięki temu współczynnik rozciągnięcia
   * wynosi 1 i przeciągnięcie o N px zmienia kolumnę dokładnie o N px, zamiast o N przemnożone
   * przez ten współczynnik. Od tej chwili kolumna jest „ręczna": nie bierze już udziału
   * w rozdziale wolnej przestrzeni, więc zwężenie jej nie odbija się z powrotem.
   */
  protected onColumnResizeStart(header: any, event: MouseEvent | TouchEvent): void {
    this._columnSizing.set({ ...this._fittedSizing() });
    this._manuallyResized.update(ids => new Set(ids).add(header.column.id));
    header.getResizeHandler()(event);
  }



  /**
   * Pozycja każdego kiedykolwiek zaznaczonego wiersza w kolejności tabeli (globalnie, przez
   * wszystkie strony). Zaznaczenie samo w sobie pamięta tylko *zbiór* identyfikatorów w
   * kolejności klikania — a panele boczne i akcje masowe mają pokazywać pozycje w tej samej
   * kolejności, w jakiej stoją w tabeli, niezależnie od tego, że użytkownik zaznaczył najpierw
   * coś ze strony trzeciej, a potem z pierwszej.
   *
   * Pozycje zapisujemy WYŁĄCZNIE przy zmianie zaznaczenia (`_recordSelectionPositions`), bo tylko
   * wtedy mamy pewność, że wyrenderowane wiersze odpowiadają bieżącej stronie. Zapis przy zmianie
   * samej paginacji dawałby fałszywe wyniki: `pageIndex` wskazuje już nową stronę, a wiersze są
   * jeszcze ze starej, więc zaznaczenie z poprzedniej strony dostawałoby offset następnej i
   * wskakiwałoby nad pozycje, które faktycznie są niżej.
   */
  private readonly _selectionPositions = new Map<string, number>();

  /** Ostatnio widziane filtry (serializowane) — `null` do pierwszego przebiegu efektu. */
  private _lastFiltersToken: string | null = null;

  /**
   * Zapamiętuje pozycje aktualnie widocznych zaznaczonych wierszy w kolejności tabeli.
   * Dzięki temu pozycja zaznaczenia z poprzedniej strony przeżywa przejście dalej, mimo że
   * jej wiersza nie ma już w pamięci.
   */
  private _recordSelectionPositions(selectedIds: string[]): void {
    // W trakcie ładowania wiersze pochodzą jeszcze z POPRZEDNIEJ strony, a `pageIndex` wskazuje
    // już nową — policzone wtedy pozycje byłyby fałszywe, więc zostajemy przy zapamiętanych.
    if (selectedIds.length === 0 || this.loading()) return;

    const selectedSet = new Set(selectedIds);
    const { pageIndex, pageSize } = this._pagination();
    // W trybie serwerowym wiersze to jedna strona — do indeksu w niej doliczamy offset strony,
    // żeby porównywać pozycje z różnych stron. W trybie klienckim tabela ma komplet danych.
    const offset = this._isServerMode() ? pageIndex * pageSize : 0;

    this._logicalRowOrder().forEach((row, index) => {
      if (selectedSet.has(row.id)) {
        this._selectionPositions.set(row.id, offset + index);
      }
    });
  }

  /** Identyfikatory zaznaczenia w kolejności tabeli (reguła sortowania: `erpOrderIdsByPosition`). */
  private _orderedSelectedIds(): string[] {
    const selection = this._rowSelection();
    const selectedIds = Object.keys(selection).filter(id => selection[id]);
    if (selectedIds.length === 0) return selectedIds;

    return erpOrderIdsByPosition(selectedIds, this._selectionPositions);
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
        filters: unwrapSignal(this.config().filters) ?? {},
        totalCount: this.itemCount(),
      });
      return;
    }

    // Kolejność zaznaczenia ma odpowiadać kolejności w tabeli, więc najpierw zapisujemy pozycje
    // wierszy widocznych TERAZ (moment kliknięcia to jedyna chwila, gdy na pewno pasują do strony),
    // a dopiero potem układamy po nich całe zaznaczenie — także to z wcześniejszych stron.
    const rawSelection = this._rowSelection();
    this._recordSelectionPositions(Object.keys(rawSelection).filter(id => rawSelection[id]));

    const selectedIds = this._orderedSelectedIds();
    const items = this.items();
    let selectedItems: T[] = [];
    if (idAccessor) {
      const itemsById = new Map(items.map(item => [idAccessor(item), item]));
      selectedItems = selectedIds.map(id => itemsById.get(id)).filter((item): item is T => item !== undefined);
    } else {
      selectedItems = selectedIds.map(id => items[parseInt(id, 10)]).filter(Boolean);
    }

    this.config().onSelectionChange?.({
      mode: isServer ? 'server' : 'client',
      isAllSelected: isServer ? false : this.table.getIsAllRowsSelected(),
      selectedItems,
      selectedIds,
      totalCount: this.itemCount(),
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
      const rows = this._logicalRowOrder();
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
        size: ErpTableComponent.SELECTION_COLUMN_SIZE,
        minSize: ErpTableComponent.SELECTION_COLUMN_SIZE,
        maxSize: ErpTableComponent.SELECTION_COLUMN_SIZE,
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
      size: col.size ?? ErpTableComponent.DEFAULT_COLUMN_SIZE,
      minSize: col.minSize ?? ErpTableComponent.DEFAULT_MIN_COLUMN_SIZE,
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
        columnSizing: this._fittedSizing(),
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
      // W trybie grupowanym paginacja nie ma sensu (wiersze są dzielone na grupy, nie strony) —
      // skalę obsługuje wyłącznie wirtualizacja.
      getPaginationRowModel: (this._isServerMode() || this._isGroupedMode()) ? undefined : getPaginationRowModel(),
      getFilteredRowModel: this._isServerMode() ? undefined : getFilteredRowModel(),

      enableRowSelection: true,
      enableMultiRowSelection: this.config().selectionMode === 'multi',
      
      onSortingChange: (updaterOrValue: any) => {
        const newVal = typeof updaterOrValue === 'function' ? updaterOrValue(this._sorting()) : updaterOrValue;
        this._sorting.set(newVal);
        // Sortowanie zmienia kolejność, w której zaznaczenie jest pokazywane i wykonywane —
        // zamiast przenosić je w nowy układ, zaczynamy od czystej kartki.
        this._resetSelectionOnDataShapeChange();
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
    count: this._flatDisplayRows().length,
    scrollElement: this.scrollElement()?.nativeElement,
    estimateSize: (index: number) => {
      const flatRow = this._flatDisplayRows()[index];
      if (flatRow?.kind === 'group') {
        return this._groupedRowsConfig()?.estimateGroupRowHeight ?? 56;
      }
      return this.config().estimatedRowHeight ?? 48;
    },
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

  protected onRightClickSelectionChange(value: boolean) {
    this._rightClickSelection.set(value);
  }

  protected onTableMouseDown(event: MouseEvent) {
    if (event.shiftKey) {
      event.preventDefault(); // Zapobiega zaznaczaniu tekstu przy Shift+Click
    }
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

  protected onRowContextMenuEvent(rowOriginal: T, event: MouseEvent) {
    if (this._rightClickSelection() && this.config().selectionMode !== 'none') {
      if (this._isServerMode() && this._serverAllSelected()) return;
      
      if (!this._rowSelectionOnClick()) {
        const target = event.target as HTMLElement;
        if (!target.closest('erp-table-selection-cell')) {
          return;
        }
      }

      const tanstackRow = this.table().getRowModel().rows.find(r => r.original === rowOriginal);
      if (tanstackRow && tanstackRow.getCanSelect()) {
        if (!tanstackRow.getIsSelected()) {
          this._handleRowSelection(tanstackRow, true, event.shiftKey);
        }
      }
    }
  }

  protected onRowDoubleClickEvent(row: T) {
    this.config().onRowDoubleClick?.(row);
  }

  // ── Grouped rows: renderowanie i interakcje ──

  protected _groupTitle(group: any): Translatable {
    return this._groupedRowsConfig()?.getGroupTitle(group) ?? '';
  }

  protected _groupSubtitle(group: any): Translatable | undefined {
    return this._groupedRowsConfig()?.getGroupSubtitle?.(group);
  }

  protected _groupIcon(group: any): string | undefined {
    return this._groupedRowsConfig()?.getGroupIcon?.(group);
  }

  protected toggleGroupExpanded(key: string): void {
    const next = new Set(this._expandedGroups());
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this._expandedGroups.set(next);
  }

  protected toggleGroupSelection(key: string, checked: boolean, shiftKey = false): void {
    const cfg = this._groupedRowsConfig();
    const childrenByGroup = this._childrenByGroup();

    if (shiftKey && cfg) {
      const anchorGroupKey = this._resolveAnchorGroupKey(cfg);
      if (anchorGroupKey) {
        const groupKeys = this._groups().map(g => cfg.getGroupKey(g));
        const anchorIndex = groupKeys.indexOf(anchorGroupKey);
        const targetIndex = groupKeys.indexOf(key);

        if (anchorIndex !== -1 && targetIndex !== -1) {
          const start = Math.min(anchorIndex, targetIndex);
          const end = Math.max(anchorIndex, targetIndex);

          const newSelection = { ...this._rowSelection() };
          for (let i = start; i <= end; i++) {
            for (const row of childrenByGroup.get(groupKeys[i]) ?? []) {
              if (row.getCanSelect()) newSelection[row.id] = checked;
            }
          }
          this._rowSelection.set(newSelection);
          this._emitSelectionChange();
          this._setSelectionAnchorToGroupEdge(key, childrenByGroup);
          return;
        }
      }
    }

    const rows = childrenByGroup.get(key) ?? [];
    const newSelection = { ...this._rowSelection() };
    for (const row of rows) {
      if (row.getCanSelect()) newSelection[row.id] = checked;
    }
    this._rowSelection.set(newSelection);
    this._emitSelectionChange();
    this._setSelectionAnchorToGroupEdge(key, childrenByGroup);
  }

  /** Rozwiązuje klucz grupy, do której należy ostatnio "dotknięty" wiersz (kotwica zakresu Shift). */
  private _resolveAnchorGroupKey(cfg: ErpGroupedRowsConfig<any, T>): string | null {
    const anchorId = this._lastSelectedRowId();
    if (!anchorId) return null;
    const anchorRow = this._logicalRowOrder().find(r => r.id === anchorId);
    return anchorRow ? cfg.getRowGroupKey(anchorRow.original) : null;
  }

  /** Ustawia kotwicę zakresu Shift na ostatni (dolny) wiersz danej grupy. */
  private _setSelectionAnchorToGroupEdge(key: string, childrenByGroup: Map<string, Row<T>[]>): void {
    const rows = childrenByGroup.get(key) ?? [];
    if (rows.length > 0) {
      this._lastSelectedRowId.set(rows[rows.length - 1].id);
    }
  }

  protected async onGroupActionClick(action: ErpGroupRowAction<any>, group: any): Promise<void> {
    await action.onClick(group);
  }

  protected _isGroupActionDisabled(action: ErpGroupRowAction<any>, group: any): boolean {
    return action.disabled?.(group) ?? false;
  }

  /** Zapewnia dociągnięcie dzieci danej grupy (jednorazowo), jeśli konfiguracja to wspiera. */
  private _ensureGroupChildrenLoaded(flatRow: Extract<FlatDisplayRow<T>, { kind: 'group' }>): void {
    const cfg = this._groupedRowsConfig();
    if (!cfg?.loadChildren || flatRow.totalCount > 0 || this._requestedGroupLoads.has(flatRow.key)) return;

    this._requestedGroupLoads.add(flatRow.key);
    const loading = new Set(this._loadingGroups());
    loading.add(flatRow.key);
    this._loadingGroups.set(loading);

    Promise.resolve(cfg.loadChildren(flatRow.group)).finally(() => {
      const next = new Set(this._loadingGroups());
      next.delete(flatRow.key);
      this._loadingGroups.set(next);
    });
  }

  public clearSelection(): void {
    if (this._isServerMode()) {
      this._serverAllSelected.set(false);
    }
    this._rowSelection.set({});
    this._selectionPositions.clear();
    this._lastSelectedRowId.set(null);
    this.table().setRowSelection({});
    this._emitSelectionChange();
  }

  /**
   * Czyści zaznaczenie po zmianie zbioru lub kolejności wierszy (sortowanie, filtry).
   *
   * Zaznaczenie w tabeli serwerowej opisuje albo listę identyfikatorów, albo filtr — jedno i
   * drugie przestaje być prawdą, gdy użytkownik zmieni filtry (zaznaczenie z poprzedniego
   * zbioru) albo sortowanie (kolejność, na której opierają się panele i „zaznacz zakres").
   * Milcząco przeniesione zaznaczenie byłoby obietnicą, której widok już nie pokazuje.
   */
  private _resetSelectionOnDataShapeChange(): void {
    const hasSelection = this._serverAllSelected() || Object.values(this._rowSelection()).some(Boolean);
    if (!hasSelection) {
      // Same pozycje i tak są już nieaktualne — opisują poprzedni układ tabeli.
      this._selectionPositions.clear();
      return;
    }

    this.clearSelection();
  }
}
